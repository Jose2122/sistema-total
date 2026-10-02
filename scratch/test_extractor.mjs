import { extraerColumnaInexistente } from '../src/utils/helpers.js';

const test1 = "Could not find the 'aprobado_compras_por' column of 'ordenes_compra' in the schema cache";
const test2 = 'column "prioridad_pago" of relation "ordenes_compra" does not exist';
const test3 = 'column ordenes_compra.estado_aprobacion_precio does not exist';
const test4 = 'column fecha_aprobacion_compras does not exist';

console.log('1:', extraerColumnaInexistente(test1));
console.log('2:', extraerColumnaInexistente(test2));
console.log('3:', extraerColumnaInexistente(test3));
console.log('4:', extraerColumnaInexistente(test4));
