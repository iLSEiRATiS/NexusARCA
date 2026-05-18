import greenfoot.*;

public class Piloto05 extends PilotoBase {

    public void maniobrar(NaveDeAtaque nave) {
        // Protocolo de encendido inicial[cite: 1]
        nave.encenderMotores(); 

        // El bucle controla la altura (6 casilleros) y la amplitud[cite: 1]
        for (int amplitud = 1; amplitud <= 6; amplitud++) {
            
            // Primero avanza un casillero al Norte[cite: 1]
            nave.avanzarHacia(Direccion.NORTE);

            // Decide la dirección de la oscilación según sea par o impar[cite: 1]
            if (amplitud % 2 != 0) {
                avanzarHaciaPor(nave, Direccion.ESTE, amplitud); 
            } else {
                avanzarHaciaPor(nave, Direccion.OESTE, amplitud); 
            }
        }

        // Protocolo de apagado final[cite: 1]
        nave.apagarMotores();
    } // Aquí cierra correctamente el método maniobrar

    /**
     * Subrutina auxiliar con parámetros para mover la nave n veces
     */
    private void avanzarHaciaPor(NaveDeAtaque nave, Direccion direccion, int pasos) {
        for (int i = 0; i < pasos; i++) {
            nave.avanzarHacia(direccion); 
        }
    } // Aquí cierra la subrutina

} // Aquí cierra la clase