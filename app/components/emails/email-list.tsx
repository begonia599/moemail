"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { CreateDialog } from "./create-dialog"
import { Mail, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useThrottle } from "@/hooks/use-throttle"
import { EMAIL_CONFIG } from "@/config"

interface Email {
  id: string
  address: string
  createdAt: number
  expiresAt: number
}

interface EmailListProps {
  onEmailSelect: (email: Email) => void
  selectedEmailId?: string
}

interface EmailResponse {
  emails: Email[]
  nextCursor: string | null
  total: number
}

export function EmailList({ onEmailSelect, selectedEmailId }: EmailListProps) {
  const { data: session } = useSession()
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)

  const fetchEmails = async (cursor?: string) => {
    try {
      const url = new URL("/api/emails", window.location.origin)
      if (cursor) {
        url.searchParams.set('cursor', cursor)
      }
      const response = await fetch(url)
      const data = await response.json() as EmailResponse
      
      if (!cursor) {
        const newEmails = data.emails
        const oldEmails = emails

        const lastDuplicateIndex = newEmails.findIndex(
          newEmail => oldEmails.some(oldEmail => oldEmail.id === newEmail.id)
        )

        if (lastDuplicateIndex === -1) {
          setEmails(newEmails)
          setNextCursor(data.nextCursor)
          setTotal(data.total)
          return
        }
        const uniqueNewEmails = newEmails.slice(0, lastDuplicateIndex)
        setEmails([...uniqueNewEmails, ...oldEmails])
        setTotal(data.total)
        return
      }
      setEmails(prev => [...prev, ...data.emails])
      setNextCursor(data.nextCursor)
      setTotal(data.total)
    } catch (error) {
      console.error("Failed to fetch emails:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchEmails()
  }

  const handleScroll = useThrottle((e: React.UIEvent<HTMLDivElement>) => {
    if (loadingMore) return

    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
    const threshold = clientHeight * 1.5
    const remainingScroll = scrollHeight - scrollTop

    if (remainingScroll <= threshold && nextCursor) {
      setLoadingMore(true)
      fetchEmails(nextCursor)
    }
  }, 200)

  useEffect(() => {
    if (session) fetchEmails()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  if (!session) return null

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 flex justify-between items-center border-b border-primary/20">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            className={cn("h-8 w-8", refreshing && "animate-spin")}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <span className="text-xs text-gray-500">
            {total}/{EMAIL_CONFIG.MAX_ACTIVE_EMAILS} 个邮箱
          </span>
        </div>
        <CreateDialog onEmailCreated={handleRefresh} />
      </div>
      
      <div className="flex-1 overflow-auto p-2" onScroll={handleScroll}>
        {loading ? (
          <div className="text-center text-sm text-gray-500">加载中...</div>
        ) : emails.length > 0 ? (
          <div className="space-y-1">
            {emails.map(email => (
              <div
                key={email.id}
                onClick={() => onEmailSelect(email)}
                className={cn(
                  "flex items-center gap-2 p-2 rounded cursor-pointer text-sm",
                  "hover:bg-primary/5",
                  selectedEmailId === email.id && "bg-primary/10"
                )}
              >
                <Mail className="w-4 h-4 text-primary/60" />
                <div className="truncate flex-1">
                  <div className="font-medium truncate">{email.address}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(email.expiresAt).getFullYear() === 9999 ? (
                      "永久有效"
                    ) : (
                      `过期时间: ${new Date(email.expiresAt).toLocaleString()}`
                    )}
                  </div>
                </div>
              </div>
            ))}
            {loadingMore && (
              <div className="text-center text-sm text-gray-500 py-2">
                加载更多...
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-sm text-gray-500">
            还没有邮箱，创建一个吧！
          </div>
        )}
      </div>
    </div>
  )
} 