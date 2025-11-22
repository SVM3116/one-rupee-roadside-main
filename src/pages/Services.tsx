import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench, Battery, Gauge, Droplets, CircleDot, Wind } from "lucide-react";

const Services = () => {
  const services = [
    {
      icon: Wrench,
      title: "General Repairs",
      description: "Expert mechanics for all types of vehicle repairs and maintenance",
    },
    {
      icon: Battery,
      title: "Battery Jump Start",
      description: "Quick battery jump-start service to get you back on the road",
    },
    {
      icon: Gauge,
      title: "Tire Services",
      description: "Flat tire repair, replacement, and tire pressure checks",
    },
    {
      icon: Droplets,
      title: "Fuel Delivery",
      description: "Emergency fuel delivery when you run out of gas",
    },
    {
      icon: CircleDot,
      title: "Brake Issues",
      description: "Brake inspection and repair services for your safety",
    },
    {
      icon: Wind,
      title: "Engine Diagnostics",
      description: "Complete engine diagnostics and troubleshooting",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4">Our Services</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Comprehensive roadside assistance services for all your vehicle needs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {services.map((service, index) => (
            <Card key={index} className="border-2 hover:border-primary transition-all hover:shadow-xl">
              <CardContent className="pt-6 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <service.icon className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-semibold">{service.title}</h3>
                <p className="text-muted-foreground">{service.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-gradient-to-r from-primary to-accent text-primary-foreground p-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Available 24/7</h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto">
              Our verified mechanics are ready to help you anytime, anywhere. 
              Fast response times and professional service guaranteed.
            </p>
          </div>
        </Card>
      </div>

      <Footer />
    </div>
  );
};

export default Services;
