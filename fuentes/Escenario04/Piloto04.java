import greenfoot.*;

public class Piloto04 extends PilotoBase {

    public void maniobrar(NaveDeAtaque nave) {
        nave.encenderMotores(); //
        
        int d = 1;
        boolean obstaculoDetectado = false;

        while (!obstaculoDetectado) {
            // IDA: Buscamos obstáculos
            int pasosDados = moverAlNorte(nave, d);
            
            // Si no pudo completar los pasos, es porque encontró un meteorito[cite: 1]
            if (pasosDados < d) {
                obstaculoDetectado = true;
            }

            // VUELTA: Regresamos a la base (aquí no chequeamos obstáculos para no trabarnos)[cite: 1]
            volverALaBase(nave, pasosDados);
            
            if (obstaculoDetectado) break; // Si ya chocó arriba, terminamos[cite: 1]
            
            d++; // Incrementamos distancia[cite: 1]
        }
        
        nave.apagarMotores(); //[cite: 1]
    }

    // Subrutina de IDA: Devuelve pasos realizados
    private int moverAlNorte(NaveDeAtaque nave, int pasos) {
        int contador = 0;
        while (contador < pasos) {
            // Solo frenamos si hay meteorito o nave enemiga (Items no)[cite: 1]
            if (nave.hayAsteroideHacia(Direccion.NORTE) || nave.hayNaveHacia(Direccion.NORTE)) {
                return contador; //
            }
            // Si llegamos al borde superior del mapa, también frenamos
            if (nave.estaEnElBorde() && contador > 0) { 
                return contador; 
            }

            nave.avanzarHacia(Direccion.NORTE); //[cite: 1]
            contador++;
        }
        return contador; //
    }

    // Subrutina de VUELTA: Simple, para asegurar que regrese sin detectar el borde como error
    private void volverALaBase(NaveDeAtaque nave, int pasos) {
        for (int i = 0; i < pasos; i++) {
            nave.avanzarHacia(Direccion.SUR); //[cite: 1]
        }
    }
}