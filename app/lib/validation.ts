import { z } from "zod"

export const authSchema = z.object({
  username: z.string().min(1, "用户名不能为空"),
  password: z.string().min(8, "密码长度必须大于等于8位"),
})

export type AuthSchema = z.infer<typeof authSchema>