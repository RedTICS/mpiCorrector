import * as sisaService from './servicioMatchSisa';
import * as config from './config';
import * as configPrivate from './config.private';

function corregirMpi() {
    let token = 'JWT ' + configPrivate.token;
    sisaService.validarPacienteEnSisa(token)
        .then((rta: any) => {
            console.log('finaliza proceso', rta);
            console.log('Fecha de ejecución: ', new Date().toString());
            process.exit(0);
        })
        .catch((err) => {
            console.error('Error**:' + err);
            process.exit(0);
        });
}

/* Inicio de la app */
corregirMpi();