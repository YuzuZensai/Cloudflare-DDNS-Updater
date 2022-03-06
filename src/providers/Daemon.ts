import Logger from "../libs/Logger";
import Environment from "./Environment";
import Configuration from "./Configuration";

import axios from "axios";
import validator from 'validator';

interface CloudflareConfig {
    token: string,
    updateInterval: number,
    zone: Array<ZoneConfig>
}

interface ZoneConfig {
    id: string,
    type: string,
    name: string,
    content: string,
    ttl: number,
    proxied: boolean
}

class Deamon {

    private config: Array<CloudflareConfig> = [];

    constructor () {
    }

    public init(): void {
        const _config = Configuration.getConfig("UpdaterConfig");
        if(!_config) {
            Logger.error('No configuration found')
            return;
        }
        
        for(let cloudflareConfig of _config) {
            if(!this.isCloudflareConfig(cloudflareConfig)) {
                Logger.error(`Invalid configuration for cloudflare: ${JSON.stringify(cloudflareConfig)}`);
                continue;
            }

            this.config.push(cloudflareConfig);
        }

        Logger.info(`Loaded ${this.config.length} cloudflare configs`);
        this.start();
    }

    public start(): void {
        Logger.info('Starting deamon');
        for(const cloudflareConfig of this.config) {
            this.update(cloudflareConfig);
            setInterval(() => this.update(cloudflareConfig), cloudflareConfig.updateInterval * 1000);
        }
    }

    private async update(cloudflareConfig: CloudflareConfig) {

        let token = cloudflareConfig.token;

        // Replace placeholders env with value
        if(this.isEnviromentTokenPlaceholder(token)) {
            const envTokenName = this.parseEnvironmentTokenPlaceholderName(token)!;
            if(process.env[envTokenName]) {
                token = process.env[envTokenName]!;
            }
            else {
                Logger.error(`Environment variable ${envTokenName} not found`);
                return;
            }
        }

        const IPv4 = await this.getCurrentIPv4();
        const IPv6 = await this.getCurrentIPv6();

        IPv4 && Logger.info(`Current IPv4 address: ${IPv4}`);
        IPv6 && Logger.info(`Current IPv6 address: ${IPv6}`);
        
        for(const zone of cloudflareConfig.zone) {
            const api = new CloudflareAPI(token, zone.id);
            const records = await api.getRecord({
                type: zone.type,
                name: zone.name
            }).catch(err => {
                Logger.error(`Unable to get records for zone ${zone.id}`);
                return err;
            });

            if(records instanceof Error) {
                continue;
            }

            // No records found, create it
            if(!records || records.length === 0) {
                const newContent = zone.content.replaceAll("{CURRENT_IPv4}", IPv4).replaceAll("{CURRENT_IPv6}", IPv6);

                const result = await api.createRecord({
                    type: zone.type,
                    name: zone.name,
                    content: IPv4,
                    ttl: zone.ttl,
                    proxied: zone.proxied
                }).catch(err => { 
                    Logger.error(`Unable to create record: ${err.message}`);
                    return err;
                });

                if(records instanceof Error) {
                    continue;
                }

                if(result)
                    Logger.info(`Created [${zone.type}] (${zone.name} -> ${newContent})`);
            }

            // Only 1 matching records found
            else if(records.length === 1) {
                const record = records[0];
                const newContent = zone.content.replaceAll("{CURRENT_IPv4}", IPv4).replaceAll("{CURRENT_IPv6}", IPv6);

                // Check if the ip is the same
                if(record.content !== IPv4 && record.content !== IPv6) {
                    const updateResult = await api.updateRecord({
                        record_id: record.id,
                        type: zone.type,
                        name: zone.name,
                        ttl: zone.ttl,
                        content: newContent,
                        proxied: zone.proxied
                    }).catch(err => { 
                        Logger.error(`Unable to update record: ${err.message}`);
                        return err;
                    });

                    if(records instanceof Error) {
                        continue;
                    }
    
                    if(updateResult)
                        Logger.info(`[${zone.type}] (${zone.name} -> ${record.content}) updated to (${zone.name} -> ${newContent})`);
                }
                else if(
                    record.ttl !== zone.ttl ||
                    record.proxied !== zone.proxied
                ) {
                    const updateResult = await api.updateRecord({
                        record_id: record.id,
                        type: zone.type,
                        name: zone.name,
                        ttl: zone.ttl,
                        content: newContent,
                        proxied: zone.proxied
                    }).catch(err => { 
                        Logger.error(`Unable to update record: ${err.message}`);
                        console.log(err);
                        return;
                    });

                    if(updateResult)
                        Logger.info(`[${zone.type}] (${zone.name} -> ${record.content}) updated proxy status/ttl (TTL: ${record.ttl} -> ${zone.ttl}) (Proxy status: ${record.proxied} -> ${zone.proxied})`);
                }
                
                else {
                    Logger.info(`[${zone.type}] (${zone.name} -> ${record.content}) already up to date`);
                    return;
                }
               
            }

            // Many records found
            else if(records.length > 1) {
                Logger.error(`Multiple records found for ${zone.type} (${zone.name}) (Multiple records are not supported right now)`);
                return;
            }

        }
    }

    private isCloudflareConfig(object: any): object is CloudflareConfig {
        
        if(!this.arraysEqual(Object.keys(object), ['token', 'updateInterval', 'zone']))
            return false;

        const res = object &&
            object.token && typeof(object.token) == 'string' &&
            object.updateInterval && typeof(object.updateInterval) == 'number';

        for(let zone of object.zone) {
            if(!this.isZoneConfig(zone))
                return false;
        }

        if(!res) return false;

        const token = object.token as string;

        // Process the env token
        if(this.isEnviromentTokenPlaceholder(token)) {
            const envTokenName = this.parseEnvironmentTokenPlaceholderName(token)!;
            const envValue = process.env[envTokenName];

            if(!envValue) {
                Logger.error(`Environment variable ${envTokenName} not found`);
                return false;
            }
        }

        return true;
    }

    private isZoneConfig(object: any): object is ZoneConfig {
        
        if(!this.arraysEqual(Object.keys(object), ['id', 'type', 'name', 'content', 'ttl', 'proxied']))
            return false;


        const res = object &&
            object.id && typeof(object.id) == 'string' &&
            object.type && typeof(object.type) == 'string' &&
            object.name && typeof(object.name) == 'string' &&
            object.content && typeof(object.content) == 'string' &&
            object.ttl && typeof(object.ttl) == 'number' &&
            typeof(object.proxied) == 'boolean';

        if(!res) return false;

        return true;
    }

    private isEnviromentTokenPlaceholder(token: string) {
        return token.startsWith('{ENV_TOKEN:') && token.endsWith('}');
    }

    private parseEnvironmentTokenPlaceholderName(token: string) {
        if(!this.isEnviromentTokenPlaceholder(token)) return null;
        return token.split('{ENV_TOKEN:')[1].slice(0, -1);
    }

    private async getCurrentIPv4() {
        const response = await axios.get("https://api.ipify.org?format=json");

        if(!response.data.ip)
            throw new Error("Unable to fetch ip address");

        if(!validator.isIP(response.data.ip, 4))
            throw new Error("Invalid IP");

        return response.data.ip;
    }

    private async getCurrentIPv6() {
        const response = await axios.get("https://api64.ipify.org/?format=json");

        if(!response.data.ip)
            throw new Error("Unable to fetch ip address");
        
        if(!validator.isIP(response.data.ip, 6))
            return null;

        return response.data.ip;
    }

    private arraysEqual(a: any, b: any) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (a.length !== b.length) return false;
      
        for (var i = 0; i < a.length; ++i) {
          if (a[i] !== b[i]) return false;
        }
        return true;
    }

}

class CloudflareAPI {
    private token: string;
    private zoneId: string;

    constructor(token: string, zoneId: string) {
        this.token = token;
        this.zoneId = zoneId;
    }

    public async getRecord({ name, type, content, proxied, page }: { name?: string, type?: string, content?: string, proxied?: boolean, page?: number }) {
        const response = await axios.get(`https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records`, {
            params: {
                name,
                type,
                perPage: 5000,
                content,
                proxied,
                page
            },
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        });

        if(response.data.success !== true)
            throw new Error(`Unable to fetch record: ${response.data.errors[0].message}`);

        return response.data.result;
    }

    public async createRecord ({ name, type, content, ttl, proxied }: { name?: string, type?: string, content?: string, ttl: number, proxied?: boolean }) {
        const response = await axios.post(`https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records`, {
            type,
            name,
            content,
            ttl,
            proxied
        }, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        });

        if(response.data.success !== true)
            throw new Error(`Unable to create record: ${response.data.errors[0].message}`);

        return response.data.result;
    }

    public async updateRecord({ record_id, name, type, content, ttl, proxied }: { record_id: string, name?: string, type?: string, content?: string, ttl: number, proxied?: boolean }) {
        const response = await axios.put(`https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records/${record_id}`, {
            type,
            name,
            content,
            ttl,
            proxied
        }, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        });

        if(response.data.success !== true)
            throw new Error(`Unable to update record: ${response.data.errors[0].message}`);

        return response.data.result;
    }
}

export default new Deamon();
