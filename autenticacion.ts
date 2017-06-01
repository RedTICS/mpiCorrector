import * as http from 'http'; 
import * as config from './config';

export function loginApp(datos: any) {
    return new Promise((resolve, reject) => {
        let options = {
            host: config.apiConfig.host,
            port: config.apiConfig.port,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        };
        let req = http.request(options, function (res) {
            res.on('data', function (body) {
               resolve(JSON.parse(body.toString()));
            });
        });
        req.on('error', function (e) {
            console.log('Problemas API : ' + e.message + ' ----- ', e);
            reject(e.message);
        });
         req.write(JSON.stringify(datos));
         req.end();
    });
}