"use client"

import { Button } from "@/components/ui/button"
import { Sword, Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { ROLES } from "@/lib/permissions"


export function PromotePanel() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handlePromote = async () => {
    if (!email) return

    setLoading(true)
    try {
      const res = await fetch(`/api/roles/users?email=${encodeURIComponent(email)}`)
      const data = await res.json() as { user?: { id: string; name?: string; email: string }; error?: string }

      if (!res.ok) throw new Error(data.error || '未知错误')
      if (!data.user) {
        toast({
          title: "未找到用户",
          description: "请确认邮箱地址是否正确",
          variant: "destructive"
        })
        return
      }

      const promoteRes = await fetch('/api/roles/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.user.id,
          roleName: ROLES.KNIGHT
        })
      })

      if (!promoteRes.ok) throw new Error('册封失败')

      toast({
        title: "册封成功",
        description: `已将 ${data.user.email} 册封为骑士`
      })
      setEmail("")

    } catch (error) {
      toast({
        title: "册封失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background rounded-lg border-2 border-primary/20 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Sword className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">册封骑士</h2>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="输入用户邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>
        <Button 
          onClick={handlePromote}
          disabled={!email || loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {loading ? "册封中..." : "册封"}
        </Button>
      </div>
    </div>
  )
} 