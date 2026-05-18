import greenfoot.*;

public class Piloto03 extends PilotoBase {

    void maniobrar(NaveDeAtaque nave) {
        nave.encenderMotores(); //

        // Simplificamos usando el mismo índice del bucle para la distancia
        for (int d = 1; d <= 7; d++) {
            mover(nave, Direccion.NORTE, d); // Ida
            mover(nave, Direccion.SUR, d);   // Vuelta
        }
        
        nave.apagarMotores(); //
    }

    // Subrutina compacta
    private void mover(NaveDeAtaque nave, Direccion dir, int pasos) {
        while (pasos-- > 0) {
            nave.avanzarHacia(dir); //
        }
    }
}

