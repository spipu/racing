/*
 * Reference trace recorder: runs Virtua Racing Deluxe in the PicoDrive libretro core,
 * replays a scenario of Mega Drive pad inputs and dumps 68K work RAM blocks every frame.
 *
 * Usage: vrTraceRecorder <core.so> <rom.32x> <scenario.txt|-> <trace.jsonl> [shots_dir]
 * The pad is a 6-button one, or a 3-button one when VR_RECORDER_PAD=3.
 *
 * Scenario lines (# starts a comment):
 *   block <hex 68K address> <byte count>   RAM block dumped every frame (declared first)
 *   <frame count> <buttons>                buttons held, joined by '+' (A B C X Y Z START MODE UP DOWN LEFT RIGHT), '-' for none
 *   shot <name>                            writes <shots_dir>/<name>.ppm of the last frame
 *   record                                 frames are written to the trace from here on
 */

#include <dlfcn.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "libretro.h"

#define MAX_BLOCKS       16
#define MAX_LINE         256
#define WORK_RAM_SIZE    0x10000
#define WORK_RAM_MASK    0xFFFF

typedef struct {
    uint32_t address;
    uint32_t size;
} RamBlock;

typedef struct {
    const char *name;
    unsigned id;
} ButtonName;

/* Mega Drive button -> libretro id, as mapped by PicoDrive (retro_pico_map). */
static const ButtonName BUTTONS[] = {
    {"A", RETRO_DEVICE_ID_JOYPAD_Y},
    {"B", RETRO_DEVICE_ID_JOYPAD_B},
    {"C", RETRO_DEVICE_ID_JOYPAD_A},
    {"X", RETRO_DEVICE_ID_JOYPAD_L},
    {"Y", RETRO_DEVICE_ID_JOYPAD_X},
    {"Z", RETRO_DEVICE_ID_JOYPAD_R},
    {"START", RETRO_DEVICE_ID_JOYPAD_START},
    {"MODE", RETRO_DEVICE_ID_JOYPAD_SELECT},
    {"UP", RETRO_DEVICE_ID_JOYPAD_UP},
    {"DOWN", RETRO_DEVICE_ID_JOYPAD_DOWN},
    {"LEFT", RETRO_DEVICE_ID_JOYPAD_LEFT},
    {"RIGHT", RETRO_DEVICE_ID_JOYPAD_RIGHT},
};
#define BUTTON_COUNT (sizeof(BUTTONS) / sizeof(BUTTONS[0]))

static uint16_t      g_inputMask    = 0;
static const void   *g_frameData    = NULL;
static unsigned      g_frameWidth   = 0;
static unsigned      g_frameHeight  = 0;
static size_t        g_framePitch   = 0;

static void (*core_init)(void);
static void (*core_deinit)(void);
static void (*core_set_environment)(retro_environment_t);
static void (*core_set_video_refresh)(retro_video_refresh_t);
static void (*core_set_audio_sample)(retro_audio_sample_t);
static void (*core_set_audio_sample_batch)(retro_audio_sample_batch_t);
static void (*core_set_input_poll)(retro_input_poll_t);
static void (*core_set_input_state)(retro_input_state_t);
static bool (*core_load_game)(const struct retro_game_info *);
static void (*core_unload_game)(void);
static void (*core_run)(void);
static void *(*core_get_memory_data)(unsigned);
static size_t (*core_get_memory_size)(unsigned);

static void fail(const char *format, ...) {
    va_list args;
    va_start(args, format);
    vfprintf(stderr, format, args);
    va_end(args);
    fputc('\n', stderr);
    exit(1);
}

static void core_log(enum retro_log_level level, const char *format, ...) {
    if (level < RETRO_LOG_WARN) {
        return;
    }
    va_list args;
    va_start(args, format);
    vfprintf(stderr, format, args);
    va_end(args);
}

static bool on_environment(unsigned cmd, void *data) {
    switch (cmd) {
        case RETRO_ENVIRONMENT_GET_LOG_INTERFACE:
            ((struct retro_log_callback *)data)->log = core_log;
            return true;
        case RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY:
        case RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY:
            *(const char **)data = ".";
            return true;
        case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT:
            return (*(enum retro_pixel_format *)data == RETRO_PIXEL_FORMAT_RGB565);
        case RETRO_ENVIRONMENT_GET_INPUT_BITMASKS:
            return true;
        case RETRO_ENVIRONMENT_GET_VARIABLE: {
            struct retro_variable *variable = (struct retro_variable *)data;
            if (strcmp(variable->key, "picodrive_region") == 0) {
                variable->value = "US";
                return true;
            }
            if (strcmp(variable->key, "picodrive_input1") == 0) {
                const char *pad = getenv("VR_RECORDER_PAD");
                variable->value = (((pad != NULL) && (strcmp(pad, "3") == 0)) ? "3 button pad" : "6 button pad");
                return true;
            }
            if (strcmp(variable->key, "picodrive_drc") == 0) {
                variable->value = "disabled";
                return true;
            }
            return false;
        }
        default:
            return false;
    }
}

static void on_video_refresh(const void *data, unsigned width, unsigned height, size_t pitch) {
    if (data == NULL) {
        return;
    }
    g_frameData   = data;
    g_frameWidth  = width;
    g_frameHeight = height;
    g_framePitch  = pitch;
}

static void on_audio_sample(int16_t left, int16_t right) {
    (void)left;
    (void)right;
}

static size_t on_audio_sample_batch(const int16_t *data, size_t frames) {
    (void)data;
    return frames;
}

static void on_input_poll(void) {
}

static int16_t on_input_state(unsigned port, unsigned device, unsigned index, unsigned id) {
    (void)index;
    if ((port != 0) || (device != RETRO_DEVICE_JOYPAD)) {
        return 0;
    }
    if (id == RETRO_DEVICE_ID_JOYPAD_MASK) {
        return (int16_t)g_inputMask;
    }
    return (int16_t)((g_inputMask >> id) & 1);
}

static void *load_symbol(void *handle, const char *name) {
    void *symbol = dlsym(handle, name);
    if (symbol == NULL) {
        fail("missing core symbol: %s", name);
    }
    return symbol;
}

static void load_core(const char *path) {
    void *handle = dlopen(path, RTLD_LAZY);
    if (handle == NULL) {
        fail("cannot load core %s: %s", path, dlerror());
    }
    *(void **)&core_init                   = load_symbol(handle, "retro_init");
    *(void **)&core_deinit                 = load_symbol(handle, "retro_deinit");
    *(void **)&core_set_environment        = load_symbol(handle, "retro_set_environment");
    *(void **)&core_set_video_refresh      = load_symbol(handle, "retro_set_video_refresh");
    *(void **)&core_set_audio_sample       = load_symbol(handle, "retro_set_audio_sample");
    *(void **)&core_set_audio_sample_batch = load_symbol(handle, "retro_set_audio_sample_batch");
    *(void **)&core_set_input_poll         = load_symbol(handle, "retro_set_input_poll");
    *(void **)&core_set_input_state        = load_symbol(handle, "retro_set_input_state");
    *(void **)&core_load_game              = load_symbol(handle, "retro_load_game");
    *(void **)&core_unload_game            = load_symbol(handle, "retro_unload_game");
    *(void **)&core_run                    = load_symbol(handle, "retro_run");
    *(void **)&core_get_memory_data        = load_symbol(handle, "retro_get_memory_data");
    *(void **)&core_get_memory_size        = load_symbol(handle, "retro_get_memory_size");
}

static void *read_file(const char *path, size_t *size) {
    FILE *file = fopen(path, "rb");
    if (file == NULL) {
        fail("cannot open %s", path);
    }
    long length = -1;
    if (fseek(file, 0, SEEK_END) == 0) {
        length = ftell(file);
    }
    if ((length < 0) || (fseek(file, 0, SEEK_SET) != 0)) {
        fail("cannot measure %s", path);
    }
    *size = (size_t)length;
    void *data = malloc(*size);
    if ((data == NULL) || (fread(data, 1, *size, file) != *size)) {
        fail("cannot read %s", path);
    }
    fclose(file);
    return data;
}

static uint16_t parse_buttons(const char *text, int lineNumber) {
    if (strcmp(text, "-") == 0) {
        return 0;
    }
    uint16_t mask = 0;
    char copy[MAX_LINE];
    snprintf(copy, sizeof(copy), "%s", text);
    for (char *token = strtok(copy, "+"); token != NULL; token = strtok(NULL, "+")) {
        bool found = false;
        for (size_t i = 0; i < BUTTON_COUNT; i++) {
            if (strcmp(token, BUTTONS[i].name) == 0) {
                mask  = (uint16_t)(mask | (1u << BUTTONS[i].id));
                found = true;
            }
        }
        if (!found) {
            fail("scenario line %d: unknown button %s", lineNumber, token);
        }
    }
    return mask;
}

/* PicoDrive keeps work RAM as native 16-bit words: byte n of a word lives at index n ^ 1 on little-endian hosts. */
static uint8_t read_ram_byte(const uint8_t *ram, uint32_t address) {
    uint32_t offset = (address & WORK_RAM_MASK);
    return ram[offset ^ 1];
}

static void write_frame(FILE *out, long frame, const char *buttons, const uint8_t *ram, const RamBlock *blocks, int blockCount) {
    fprintf(out, "{\"frame\":%ld,\"buttons\":\"%s\",\"blocks\":{", frame, buttons);
    for (int b = 0; b < blockCount; b++) {
        fprintf(out, "%s\"%06X\":\"", ((b > 0) ? "," : ""), blocks[b].address);
        for (uint32_t i = 0; i < blocks[b].size; i++) {
            fprintf(out, "%02X", read_ram_byte(ram, blocks[b].address + i));
        }
        fputc('"', out);
    }
    fputs("}}\n", out);
}

static void write_shot(const char *directory, const char *name) {
    if ((directory == NULL) || (g_frameData == NULL)) {
        fail("shot %s: no shots directory or no frame rendered yet", name);
    }
    char path[1024];
    snprintf(path, sizeof(path), "%s/%s.ppm", directory, name);
    FILE *file = fopen(path, "wb");
    if (file == NULL) {
        fail("cannot write %s", path);
    }
    fprintf(file, "P6\n%u %u\n255\n", g_frameWidth, g_frameHeight);
    for (unsigned y = 0; y < g_frameHeight; y++) {
        const uint16_t *row = (const uint16_t *)((const uint8_t *)g_frameData + (y * g_framePitch));
        for (unsigned x = 0; x < g_frameWidth; x++) {
            uint16_t pixel = row[x];
            uint8_t rgb[3] = {
                (uint8_t)(((pixel >> 11) & 0x1F) << 3),
                (uint8_t)(((pixel >> 5) & 0x3F) << 2),
                (uint8_t)((pixel & 0x1F) << 3),
            };
            fwrite(rgb, 1, sizeof(rgb), file);
        }
    }
    fclose(file);
}

int main(int argc, char **argv) {
    if ((argc < 5) || (argc > 6)) {
        fail("usage: %s <core.so> <rom.32x> <scenario.txt> <trace.jsonl> [shots_dir]", argv[0]);
    }
    const char *shotsDir = ((argc == 6) ? argv[5] : NULL);

    load_core(argv[1]);
    core_set_environment(on_environment);
    core_init();
    core_set_video_refresh(on_video_refresh);
    core_set_audio_sample(on_audio_sample);
    core_set_audio_sample_batch(on_audio_sample_batch);
    core_set_input_poll(on_input_poll);
    core_set_input_state(on_input_state);

    struct retro_game_info game = {0};
    game.path = argv[2];
    game.data = read_file(argv[2], &game.size);
    if (!core_load_game(&game)) {
        fail("core refused the ROM");
    }
    const uint8_t *ram = (const uint8_t *)core_get_memory_data(RETRO_MEMORY_SYSTEM_RAM);
    if ((ram == NULL) || (core_get_memory_size(RETRO_MEMORY_SYSTEM_RAM) < WORK_RAM_SIZE)) {
        fail("core does not expose 68K work RAM");
    }

    FILE *scenario = ((strcmp(argv[3], "-") == 0) ? stdin : fopen(argv[3], "r"));
    FILE *out      = fopen(argv[4], "w");
    if ((scenario == NULL) || (out == NULL)) {
        fail("cannot open scenario or trace file");
    }

    RamBlock blocks[MAX_BLOCKS];
    int      blockCount = 0;
    long     frame      = 0;
    int      lineNumber = 0;
    bool     recording  = false;
    char     line[MAX_LINE];
    while (fgets(line, sizeof(line), scenario) != NULL) {
        lineNumber++;
        char *comment = strchr(line, '#');
        if (comment != NULL) {
            *comment = '\0';
        }
        char first[MAX_LINE];
        char second[MAX_LINE];
        char third[MAX_LINE];
        int  fields = sscanf(line, "%255s %255s %255s", first, second, third);
        if (fields <= 0) {
            continue;
        }
        if ((strcmp(first, "block") == 0) && (fields == 3)) {
            if ((blockCount == MAX_BLOCKS) || recording) {
                fail("scenario line %d: too many blocks, or block declared after inputs", lineNumber);
            }
            blocks[blockCount].address = (uint32_t)strtoul(second, NULL, 16);
            blocks[blockCount].size    = (uint32_t)strtoul(third, NULL, 0);
            blockCount++;
            continue;
        }
        if ((strcmp(first, "record") == 0) && (fields == 1)) {
            recording = true;
            continue;
        }
        if ((strcmp(first, "shot") == 0) && (fields == 2)) {
            write_shot(shotsDir, second);
            continue;
        }
        if (fields != 2) {
            fail("scenario line %d: expected '<frames> <buttons>'", lineNumber);
        }
        char *end   = NULL;
        long  count = strtol(first, &end, 10);
        if ((*end != '\0') || (count < 0)) {
            fail("scenario line %d: bad frame count '%s'", lineNumber, first);
        }
        g_inputMask = parse_buttons(second, lineNumber);
        for (long i = 0; i < count; i++) {
            core_run();
            if (recording) {
                write_frame(out, frame, second, ram, blocks, blockCount);
            }
            frame++;
        }
    }

    if (scenario != stdin) {
        fclose(scenario);
    }
    fclose(out);
    core_unload_game();
    core_deinit();
    free((void *)game.data);
    fprintf(stderr, "%ld frames run\n", frame);
    return 0;
}
