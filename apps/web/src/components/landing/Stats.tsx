const stats = [
  { id: 1, name: "Orders Processed", value: "10K+" },
  { id: 2, name: "Active Users", value: "500+" },
  { id: 3, name: "Material Categories", value: "100+" },
  { id: 4, name: "Uptime", value: "99.9%" },
];

export function Stats() {
  return (
    <section className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:max-w-none">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Trusted by businesses worldwide
            </h2>
            <p className="mt-4 text-lg leading-8 text-gray-600">
              Join thousands of companies already using B3Hub to streamline their operations
            </p>
          </div>
          <dl className="mt-16 grid grid-cols-1 gap-0.5 overflow-hidden rounded-2xl text-center sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.id} className="flex flex-col bg-white p-8">
                <dt className="text-sm font-semibold leading-6 text-gray-600">
                  {stat.name}
                </dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-red-600">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
