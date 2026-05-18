import prisma from '../config/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError';

const JWT_SECRET = process.env.JWT_SECRET || 'engroncho_master_key_2026';

export class UserService {
  static async login(username: string, password: string) {
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !user.active) {
      throw new AppError('Usuario no encontrado o inactivo', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new AppError('Contraseña incorrecta', 401);
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        role: user.role
      }
    };
  }

  static async createInitialAdmin() {
    const adminExists = await prisma.user.findUnique({ where: { username: 'admin' } });
    
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      await prisma.user.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          nombre: 'Administrador',
          role: 'ADMIN'
        }
      });
      console.log('Usuario admin inicial creado (admin / admin123)');
    }
  }
}
