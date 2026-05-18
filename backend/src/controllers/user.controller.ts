import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { asyncHandler } from '../utils/asyncHandler';

export class UserController {
  static login = asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const result = await UserService.login(username, password);
    res.json(result);
  });
}
