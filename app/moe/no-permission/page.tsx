import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Crown } from "lucide-react"
import Link from "next/link"

export default function NoPermissionPage() {
  return (
    <div className="bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 h-screen">
      <div className="container mx-auto h-full px-4 lg:px-8 max-w-[1600px]">
        <Header />
        <main className="h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <Crown className="w-12 h-12 text-primary mx-auto" />
            <h1 className="text-2xl font-bold">权限不足</h1>
            <p className="text-muted-foreground">你没有权限访问此页面，请联系皇帝</p>
            <Link href="/">
              <Button>返回首页</Button>
            </Link>
          </div>
        </main>
      </div>
    </div>
  )
} 