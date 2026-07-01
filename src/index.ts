import App from "./providers/app";

App.loadConfig();
App.loadENV();
App.loadUpdater();

export default App;
