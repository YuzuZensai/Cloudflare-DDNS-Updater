import Logger from '../libs/Logger';

import Environment from './Environment';
import Configuration from './Configuration';
import Daemon from './Daemon';

class App {
    public loadConfig(): void {
        Logger.log('info', 'Loading configuration');
        Configuration.init();
    }

    public loadENV(): void {
        Logger.log('info', 'Loading environment');
        Environment.init();
    }
    public loadDaemon() : void {
        Logger.log('info', 'Loading daemon');
        Daemon.init();
    }
}

export default new App;