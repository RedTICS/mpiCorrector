import * as config from './config';
import * as mongodb from 'mongodb';
import {
    servicioSisa
} from '../api/utils/servicioSisa'; /* Esto hay que corregirlo y enviarlo a un paquete a parte */
import {
    matching
} from '@andes/match';
import {
    PacienteMpi
} from './pacienteMpi';

let servSisa = new servicioSisa();
let match = new matching();


// Función de algoritmo de matcheo para servicio de sisa
function matchSisa(paciente) {
    //Verifica si el paciente tiene un documento valido y realiza la búsqueda a través de Sisa
    var matchPorcentaje = 0;
    var pacienteSisa = {};
    var weights = config.pesos;

    //Se buscan los datos en sisa y se obtiene el paciente
    return new Promise((resolve, reject) => {

        if (paciente.documento) {
            if (paciente.documento.length >= 6) {
                servSisa.getSisaCiudadano(paciente.documento, config.usuarioSisa, config.passwordSisa)
                    .then((resultado) => {
                        if (resultado) {
                            //Verifico el resultado devuelto por el rest de Sisa
                            if (resultado[0] == 200) {
                                switch (resultado[1].Ciudadano.resultado) {
                                    case 'OK':
                                        if (resultado[1].Ciudadano.identificadoRenaper && resultado[1].Ciudadano.identificadoRenaper != "NULL") {
                                            pacienteSisa = servSisa.formatearDatosSisa(resultado[1].Ciudadano);
                                            matchPorcentaje = match.matchPersonas(paciente, pacienteSisa, weights, config.tipoAlgoritmoMatcheo);
                                            resolve([{
                                                _id: paciente._id
                                            }, matchPorcentaje, pacienteSisa]);
                                        } else {
                                            resolve([{
                                                _id: paciente._id
                                            }, 0, {}]);
                                        }
                                        break;
                                    case 'MULTIPLE_RESULTADO':
                                        var sexo = "F";
                                        if (paciente.sexo == "femenino") {
                                            sexo = "F";
                                        }
                                        if (paciente.sexo == "masculino") {
                                            sexo = "M";
                                        }
                                        servSisa.getSisaCiudadano(paciente.documento, config.usuarioSisa, config.passwordSisa, sexo)
                                            .then((res) => {
                                                if (res[1].Ciudadano.resultado == 'OK') {
                                                    pacienteSisa = servSisa.formatearDatosSisa(res[1].Ciudadano);
                                                    matchPorcentaje = match.matchPersonas(paciente, pacienteSisa, weights, 'Levenshtein');
                                                    resolve([{
                                                        _id: paciente._id
                                                    }, matchPorcentaje, pacienteSisa]);
                                                }

                                            })
                                            .catch((err) => {
                                                reject(err);
                                            })

                                    default:
                                        resolve([{
                                            _id: paciente._id
                                        }, 0]);
                                        break;
                                }
                            }
                        }
                        resolve([{
                            _id: paciente._id
                        }, 0, {}]);
                    })
                    .catch((err) => {
                        console.error('Error consulta rest Sisa:' + err)
                        reject(err);
                    });
                // setInterval(consultaSisa,100);
            } else {
                resolve([{
                    _id: paciente._id
                }, matchPorcentaje, {}]);
            }
        } else {
            resolve([{
                _id: paciente._id
            }, matchPorcentaje, {}]);
        }
    })
}

// servicioMatchSisa era el nombre de la clase
export function validarPacienteEnSisa(token) {
    let url = config.urlMongoMpi;
    let urlSisaRejected = config.urlMongoSisaRejected;
    let coleccion = 'paciente';
    let coleccionRejected = 'sisaRejected';
    // Esta condición es para obtener todos los pacientes que no tengan la entidadValidadora "Sisa" o bien el campo no exista.
    return new Promise((resolve, reject) => {
        try {
            let condicion = {
                'entidadesValidadoras': {
                    $nin: ['Sisa']
                }
            };

            mongodb.MongoClient.connect(url, function (err, db) {
                if (err) {
                    console.log('Error al conectarse a Base de Datos: ', err);
                    db.close();
                    reject('error');
                } else {
                    let cursorStream = db.collection(coleccion).find(condicion).stream();
                    let myData = cursorStream.toArray;
                    cursorStream.on('end', function () {
                        db.close(); //Cerramos la conexión a la bd de MPI
                        resolve('fin');
                    })
                    cursorStream.on('error', function (){
                        db.close(); // Cerramos la bd y rejectamos el error que pudiera haber
                        reject('error mongo stream');
                    })
                    cursorStream.on('data', function (data) {
                        if (data != null) {
                            // Se realiza una pausa para realizar la consulta a Sisa
                            cursorStream.pause();
                            let paciente: any = data;
                            servSisa.matchSisa(paciente).then(res => {
                                if (res) {
                                    let operationsMpi = new PacienteMpi();
                                    let match = res["matcheos"].matcheo // Valor del matcheo de sisa
                                    let pacienteSisa = res["matcheos"].datosPaciente; //paciente con los datos de Sisa originales
                                    if (match >= 95) {
                                        //Si el matcheo es mayor a 95% tengo que actualizar los datos en MPI
                                        console.log('apellido y nombres segun sisa: ', pacienteSisa.nombre + ' ' + pacienteSisa.apellido);
                                        paciente.nombre = pacienteSisa.nombre;
                                        paciente.apellido = pacienteSisa.apellido;
                                    } else {
                                        // insertar en una collection sisaRejected para análisis posterior
                                        mongodb.MongoClient.connect(url, function (err, db2) {
                                            //Verificamos que el paciente no exista en la collection de rejected!
                                            db2.collection(coleccionRejected).findOne(paciente._id, function (err, patientRejected) {
                                                if (err) {
                                                    reject(err);
                                                } else {
                                                    if (!patientRejected) {
                                                        db2.collection(coleccionRejected).insert(paciente);
                                                    }
                                                }
                                                db2.close(); //Cerramos la conexión a la db de rejected patient
                                            });
                                        })
                                    }
                                    //Siempre marco que paso por sisa
                                    paciente.entidadesValidadoras.push('Sisa');
                                    console.log('El paciente actualizado: ',paciente);
                                    //Hacemos el update en el repositorio MPI
                                    operationsMpi.actualizaUnPacienteMpi(paciente, token)
                                        .then((rta) => {
                                            console.log('El paciente de MPI ha sido corregido por SISA: ', paciente);
                                            cursorStream.resume(); //Reanudamos el proceso
                                        });
                                        
                                }
                               
                            })
                        }
                    })
                }
            });
        } catch (err) {
            console.log('Error catch:', err);
            reject('error');
        };

    })
}