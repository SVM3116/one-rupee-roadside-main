import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";

const About = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-gray-800 via-gray-700 to-orange-600 bg-clip-text text-transparent">
              ONE RUPEE
            </h1>
            <h2 className="text-4xl font-bold mb-4 text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]">
              RAPIDFIX.
            </h2>
            <p className="text-2xl font-semibold text-orange-500 mb-4">
              WHEN ROADS STOP YOU, WE DON'T.
            </p>
            <p className="text-xl text-muted-foreground">
              Connecting travelers with trusted mechanics across India
            </p>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <h2 className="text-3xl font-bold">Our Mission</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                ONE RUPEE RAPIDFIX was founded with a simple yet powerful mission: to ensure that no traveler 
                is left stranded on the road. We believe that everyone deserves access to quick, reliable, 
                and affordable roadside assistance, no matter where they are in India. When roads stop you, we don't.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <h2 className="text-3xl font-bold">How It Works</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold mb-2">1. Request Help</h3>
                  <p className="text-muted-foreground">
                    Use our platform to request assistance. Share your location and describe your vehicle issue.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">2. Connect with Mechanic</h3>
                  <p className="text-muted-foreground">
                    Get matched with verified mechanics near you. Track their arrival in real-time.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">3. Get Fixed</h3>
                  <p className="text-muted-foreground">
                    Professional mechanics arrive to fix your vehicle on the spot. Pay securely through our platform.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <h2 className="text-3xl font-bold">Why Trust Us</h2>
              <ul className="space-y-3 text-lg text-muted-foreground">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  All mechanics are verified with background checks
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  Transparent pricing with no hidden charges
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  24/7 customer support for your peace of mind
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  Secure payment gateway for safe transactions
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  Community-driven ratings and reviews
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default About;
