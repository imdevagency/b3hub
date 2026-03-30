const stats = [
  { id: 1, name: 'Apstrādātie Pasūtījumi', value: '10K+' },
  { id: 2, name: 'Aktīvie Lietotāji', value: '500+' },
  { id: 3, name: 'Materiālu Kategorijas', value: '100+' },
  { id: 4, name: 'Darblaiks', value: '99.9%' },
];

export function Stats() {
  return (
    <section className="bg-black py-32 sm:py-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:max-w-none">
          <div className="text-center mb-24">
            <h2 className="text-4xl font-bold tracking-tighter text-white sm:text-5xl">
              Cipari runā paši par sevi.
            </h2>
            <p className="mt-6 text-lg text-white/50">
              Pievienojieties uzņēmumiem, kas jau izmanto B3Hub infrastruktūru.
            </p>
          </div>
          <dl className="grid grid-cols-1 gap-px bg-white/10 border border-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.id} className="flex flex-col bg-black p-12 text-center">
                <dd className="text-5xl font-bold tracking-tighter text-white mb-4">
                  {stat.value}
                </dd>
                <dt className="text-sm font-medium tracking-widest uppercase text-white/40">
                  {stat.name}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
