import * as sisaService from './servicioMatchSisa';
import * as autentica from './autenticacion';
import * as config from './config';

function corregirMpi() {
    autentica.loginApp(config.loginData)
        .then(value => {
            value.token = 'JWT ' + value.token;
            sisaService.validarPacienteEnSisa(value.token)
                .then((rta: any) => {
                    console.log('finaliza proceso', rta);
                    process.exit(0);
                })
                .catch((err) => {
                    console.error('Error**:' + err);
                });
        })
        .catch((err2) => {
                console.error('Error**:' + err2);
        });        
}
/* Inicio de la app */
corregirMpi();