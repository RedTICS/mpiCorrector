import * as config from './config';
import * as mongodb from 'mongodb';
import { matchSisa } from '../api/utils/servicioSisa'; /* Esto hay que corregirlo y enviarlo a un paquete a parte */
import {
    matching
} from '@andes/match';
import {
    PacienteMpi
} from './pacienteMpi';

let match = new matching();

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
                    cursorStream.on('error', function () {
                        db.close(); // Cerramos la bd y rejectamos el error que pudiera haber
                        reject('error mongo stream');
                    })
                    cursorStream.on('data', function (data) {
                        if (data != null) {
                            // Se realiza una pausa para realizar la consulta a Sisa
                            cursorStream.pause();
                            let paciente: any = data;
                            matchSisa(paciente).then(res => {
                                if (res) {
                                    let operationsMpi = new PacienteMpi();
                                    //console.log("RESPUESTA ----", res);
                                    let match = res["matcheos"].matcheo // Valor del matcheo de sisa
                                    let pacienteSisa = res["matcheos"].datosPaciente; //paciente con los datos de Sisa originales
                                    //console.log("MATCHHH ----", match);
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
                                    console.log('El paciente actualizado: ', paciente);
                                    //Hacemos el update en el repositorio MPI
                                    operationsMpi.actualizaUnPacienteMpi(paciente, token)
                                        .then((rta) => {
                                            console.log('El paciente de MPI ha sido corregido por SISA: ', paciente);
                                            cursorStream.resume(); //Reanudamos el proceso
                                        }).catch((err) => {
                                            console.log('Error al intentar corregir El paciente de MPI con datos de SISA: ', paciente);
                                            reject(err);
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