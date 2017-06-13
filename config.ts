import * as configPrivate from './config.private';

/*SETTINGS*/
export const apiConfig = {
    host: configPrivate.host,
    port: configPrivate.port,
    pathPacienteMpi: '/api/core/mpi/pacientes/mpi'
};
export const tipoAlgoritmoMatcheo = 'Levenshtein';
export const pesos = {
            identity: 0.3, 
            name: 0.3,   
            gender: 0.1, 
            birthDate: 0.3
        };

