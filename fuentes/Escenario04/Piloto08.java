import greenfoot.*;

public class Piloto08 extends PilotoBase {

    public void maniobrar(NaveDeAtaque nave) {
        // CORRECCIÓN: Usamos getWorld() para obtener el escenario
        Escenario escenario = (Escenario) nave.getWorld(); 
        NaveRecolectora recolectora = escenario.obtenerNaveRecolectora();
        
        recolectora.encenderMotores();

        // 1. Recolección: Mover a 7B para extraer de 7A (OESTE)
        recolectora.avanzarHacia(Direccion.OESTE); 
        recolectora.recolectarDesde(Direccion.OESTE);
        recolectora.avanzarHacia(Direccion.ESTE); 

        // 2. Distribución
        asistirEscuadron(recolectora);

        recolectora.apagarMotores();
    }

    private void asistirEscuadron(NaveRecolectora r) {
        // Nave 8A
        r.avanzarHacia(Direccion.SUR);
        r.avanzarHacia(Direccion.OESTE);
        r.transferirCombustibleHacia(Direccion.OESTE, 50);

        // Nave 8C
        r.avanzarHacia(Direccion.ESTE);
        r.avanzarHacia(Direccion.ESTE);
        r.transferirCombustibleHacia(Direccion.ESTE, 50);

        // Nave 9B
        r.avanzarHacia(Direccion.OESTE);
        r.avanzarHacia(Direccion.SUR);
        r.transferirCombustibleHacia(Direccion.SUR, 50);
    }
}