import greenfoot.*;

public class Piloto06 extends PilotoBase {

    public void maniobrar(NaveDeAtaque nave) {
        nave.encenderMotores(); // Protocolo de inicio

        int pasos = 1;

        // 1. Ejecución de las 3 vueltas en espiral
        for (int vuelta = 0; vuelta < 3; vuelta++) {
            
            // Tramo A: Norte y Este
            avanzarHaciaPor(nave, Direccion.NORTE, pasos);
            avanzarHaciaPor(nave, Direccion.ESTE, pasos);
            
            pasos++; // Incremento de amplitud
            
            // Tramo B: Sur y Oeste
            avanzarHaciaPor(nave, Direccion.SUR, pasos);
            avanzarHaciaPor(nave, Direccion.OESTE, pasos);
            
            pasos++; // Incremento para la siguiente vuelta
        }

        // 2. MANIOBRA DE CORRECCIÓN Y ESTACIONAMIENTO:
        // Primero subimos para alinearnos con la fila 4
        avanzarHaciaPor(nave, Direccion.NORTE, pasos);
        
        // Estábamos en 4E y necesitamos llegar a 4G (2 pasos al ESTE)
        // Además, esto dejará a la nave mirando al ESTE como pide el ejercicio
        avanzarHaciaPor(nave, Direccion.ESTE, 3);

        nave.apagarMotores(); // Protocolo de finalización
    } // Cierre de maniobrar

    /**
     * Subrutina modular: Mueve la nave n veces.
     * Declarada fuera de maniobrar para evitar errores de expresión.
     */
    private void avanzarHaciaPor(NaveDeAtaque nave, Direccion direccion, int cantidad) {
        for (int i = 0; i < cantidad; i++) {
            if (!nave.estaEnElBorde()) { 
                nave.avanzarHacia(direccion);
            }
        }
    } // Cierre de la subrutina

} // Cierre de la clase