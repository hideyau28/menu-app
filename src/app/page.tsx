import prisma from '@/lib/prisma'

// 這是 Server Component，直接在伺服器讀取 Database
export default async function Home() {
  const categories = await prisma.category.findMany({
    include: {
      items: true,
    },
  })

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-10">🍽️ 我們的餐牌</h1>
        
        {categories.map((category) => (
          <section key={category.id} className="mb-12">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-orange-200 pb-2 inline-block">
              {category.name}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {category.items.map((item) => (
                <div key={item.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition duration-200">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">{item.name}</h3>
                    <span className="text-lg font-bold text-orange-600">${item.price}</span>
                  </div>
                  {item.description && (
                    <p className="text-gray-500 text-sm">{item.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
