/*SETTINGS*/
export const apiConfig = {
    host:'127.0.0.1',
    port: 3002, /* Deberá cambiarse por el port 80 para producción */
    pathPacienteMpi: '/api/core/mpi/pacientes/mpi'
};
export const tipoAlgoritmoMatcheo = 'Levenshtein';
export const pesos = {
            identity: 0.3, 
            name: 0.3,   
            gender: 0.1, 
            birthDate: 0.3
        };

