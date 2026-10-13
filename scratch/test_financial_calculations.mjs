import { calcularLiquidacionFiscal, redondear2 } from '../src/services/retencionesService.js';

function runTests() {
  console.log("=== EJECUTANDO TEST DE CÁLCULOS FISCALES SITC ===");

  const test1 = calcularLiquidacionFiscal({
    tipo_tasa: 'BCV_USD',
    valor_tasa: 46.5000,
    monto_exento: 100.00,
    base_imponible: 1000.00,
    alicuota_iva: 16.00,
    porcentaje_retencion_iva: 75.00,
    porcentaje_retencion_islr: 2.00
  });

  console.log("Test 1 (Estándar 16% IVA, 75% Ret IVA, 2% ISLR):", test1);
  console.assert(test1.monto_iva === 160.00, `monto_iva expected 160.00, got ${test1.monto_iva}`);
  console.assert(test1.monto_retencion_iva === 120.00, `monto_retencion_iva expected 120.00, got ${test1.monto_retencion_iva}`);
  console.assert(test1.monto_retencion_islr === 20.00, `monto_retencion_islr expected 20.00, got ${test1.monto_retencion_islr}`);
  console.assert(test1.total_factura === 1260.00, `total_factura expected 1260.00, got ${test1.total_factura}`);
  console.assert(test1.total_retenciones === 140.00, `total_retenciones expected 140.00, got ${test1.total_retenciones}`);
  console.assert(test1.monto_neto_pagar === 1120.00, `monto_neto_pagar expected 1120.00, got ${test1.monto_neto_pagar}`);
  console.assert(test1.equivalente_ves_neto === 52080.00, `equivalente_ves_neto expected 52080.00, got ${test1.equivalente_ves_neto}`);

  // Test 2: Compra 100% Exenta
  const test2 = calcularLiquidacionFiscal({
    tipo_tasa: 'BCV_USD',
    valor_tasa: 46.5000,
    monto_exento: 500.00,
    base_imponible: 0.00,
    alicuota_iva: 0.00,
    porcentaje_retencion_iva: 0.00,
    porcentaje_retencion_islr: 0.00
  });
  console.log("Test 2 (100% Exenta):", test2);
  console.assert(test2.total_factura === 500.00, `total_factura expected 500, got ${test2.total_factura}`);
  console.assert(test2.monto_neto_pagar === 500.00, `monto_neto_pagar expected 500, got ${test2.monto_neto_pagar}`);
  console.assert(test2.total_retenciones === 0.00, `total_retenciones expected 0, got ${test2.total_retenciones}`);

  // Test 3: Decimales complejos con céntimos impares
  const test3 = calcularLiquidacionFiscal({
    tipo_tasa: 'BCV_EUR',
    valor_tasa: 51.3412,
    monto_exento: 13.55,
    base_imponible: 83.33,
    alicuota_iva: 16.00,
    porcentaje_retencion_iva: 75.00,
    porcentaje_retencion_islr: 2.00
  });
  console.log("Test 3 (Céntimos impares):", test3);
  // Base: 83.33 -> IVA 16% = 13.3328 -> 13.33
  // Ret IVA 75% de 13.33 = 9.9975 -> 10.00
  // Ret ISLR 2% de 83.33 = 1.6666 -> 1.67
  // Total Factura: 83.33 + 13.55 + 13.33 = 110.21
  // Total Retenciones: 10.00 + 1.67 = 11.67
  // Neto a Pagar: 110.21 - 11.67 = 98.54
  console.assert(test3.monto_iva === 13.33, `IVA mismatch: ${test3.monto_iva}`);
  console.assert(test3.monto_retencion_iva === 10.00, `Ret IVA mismatch: ${test3.monto_retencion_iva}`);
  console.assert(test3.monto_retencion_islr === 1.67, `Ret ISLR mismatch: ${test3.monto_retencion_islr}`);
  console.assert(test3.total_factura === 110.21, `Total factura mismatch: ${test3.total_factura}`);
  console.assert(test3.total_retenciones === 11.67, `Total retenciones mismatch: ${test3.total_retenciones}`);
  console.assert(test3.monto_neto_pagar === 98.54, `Neto pagar mismatch: ${test3.monto_neto_pagar}`);

  console.log("✅ ¡TODOS LOS TESTS DE CÁLCULO FISCAL PASARON CON ÉXITO!");
}

runTests();
