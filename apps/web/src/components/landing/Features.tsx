import { 
  ShoppingCart, 
  Users, 
  Package, 
  BarChart3, 
  Shield, 
  Zap 
} from "lucide-react";

const features = [
  {
    name: "Material Management",
    description: "Efficiently manage your material inventory with real-time tracking, categorization, and availability status.",
    icon: Package,
  },
  {
    name: "Order Processing",
    description: "Streamline order workflows from creation to delivery. Track status, manage fulfillment, and keep customers informed.",
    icon: ShoppingCart,
  },
  {
    name: "Multi-User Support",
    description: "Role-based access for suppliers, customers, and managers. Each user type gets tailored features and permissions.",
    icon: Users,
  },
  {
    name: "Real-time Analytics",
    description: "Gain insights into your operations with comprehensive dashboards and reporting tools.",
    icon: BarChart3,
  },
  {
    name: "Secure & Reliable",
    description: "Enterprise-grade security with Supabase authentication and encrypted data storage.",
    icon: Shield,
  },
  {
    name: "Lightning Fast",
    description: "Built with modern technologies for optimal performance across web and mobile platforms.",
    icon: Zap,
  },
];

export function Features() {
  return (
    <section id="features" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-red-600">
            Everything you need
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Powerful Features for Modern Businesses
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            B3Hub provides all the tools you need to manage materials and orders efficiently.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-7xl sm:mt-20 lg:mt-24">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-3 lg:gap-y-16">
            {features.map((feature) => (
              <div key={feature.name} className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-red-600">
                    <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  {feature.name}
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">
                  {feature.description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
