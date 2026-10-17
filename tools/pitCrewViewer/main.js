appBootstrap.disablePwaMode();
appBootstrap.addBootstrapDefinition('/tools/pitCrewViewer/bootstrap.json');
appBootstrap.setReadyCallback(() => new PitCrewViewer().load());
