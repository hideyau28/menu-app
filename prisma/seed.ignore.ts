import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('🌱 開始入資料...')

  // 1. 清空舊資料 (以免重複 Run 變到好多份)
  await prisma.menuItem.deleteMany()
  await prisma.category.deleteMany()

  // 2. 建立 Category: 主食
  const mainCourse = await prisma.category.create({
    data: {
      name: '主食 (Main Course)',
      items: {
        create: [
          { name: '香煎雞扒', price: 68, description: '脆皮嫩滑，配薯菜' },
          { name: '卡邦尼意粉', price: 78, description: '傳統意大利風味' },
        ],
      },
    },
  })

  // 3. 建立 Category: 飲品
  const drinks = await prisma.category.create({
    data: {
      name: '飲品 (Drinks)',
      items: {
        create: [
          { name: '凍檸茶', price: 18 },
          { name: '熱咖啡', price: 22 },
        ],
      },
    },
  })

  console.log('✅ 資料輸入完成！')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
