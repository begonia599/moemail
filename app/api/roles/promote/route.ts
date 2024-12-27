import { createDb } from "@/lib/db";
import { roles, userRoles } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { ROLES } from "@/lib/permissions";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const { userId, roleName } = await request.json() as { userId: string, roleName: string };
    if (!userId || !roleName) {
      return Response.json(
        { error: "缺少必要参数" },
        { status: 400 }
      );
    }

    if (roleName !== ROLES.KNIGHT) {
      return Response.json(
        { error: "角色不合法" },
        { status: 400 }
      );
    }

    const db = createDb();

    let targetRole = await db.query.roles.findFirst({
      where: eq(roles.name, roleName),
    });

    if (!targetRole) {
      const [newRole] = await db.insert(roles)
        .values({
          name: roleName,
          description: "高级用户",
        })
        .returning();
      targetRole = newRole;
    }

    await db.delete(userRoles)
      .where(eq(userRoles.userId, userId));

    await db.insert(userRoles)
      .values({
        userId,
        roleId: targetRole.id,
      });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to promote user:", error);
    return Response.json(
      { error: "升级用户失败" },
      { status: 500 }
    );
  }
}