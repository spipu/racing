function loadApp() {
    new AppViewportStabilizer().install();

    // The saved language is applied once the settings are read (RacingMenuNavigator.start).
    appTranslator.addCatalog(AppMenuTranslations.CATALOG)
        .addCatalog(RacingTranslations.CATALOG)
        .setFallbackLanguage('en')
        .setLanguage('en');

    new RacingMenuNavigator().start();
}

appBootstrap.setReadyCallback(loadApp);
