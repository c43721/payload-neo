import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthedRequest } from "../../lib/types/DiscordAuth";

export default function checkAdmin(req: Request, res: Response, next: NextFunction) {
	const token = req.cookies.token;
	if (!token) return res.status(401).json({ message: "Unauthorized" });

	try {
		const user = jwt.verify(token, process.env.JWT_SECRET) as AuthedRequest;
		req.user = user;

		if (user.isAdmin) return next();
		return res.status(401).json({ message: "Unauthorized" });
	} catch (ex) {
		return res.status(401).json({ message: "Unauthorized" });
	}
}