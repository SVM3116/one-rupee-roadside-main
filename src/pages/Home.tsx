import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench, MapPin, Shield, Clock, Star, CreditCard } from "lucide-react";
import heroImage from "@/assets/hero-roadside.jpg";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Testimonials from "@/components/Testimonials";
import AnimatedText from "@/components/AnimatedText";

const Home = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-secondary/30 to-background">
        <div className="container mx-auto px-4 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                  <AnimatedText 
                    text="ONE RUPEE" 
                    delay={0}
                    letterDelay={120}
                    loopDelay={1500}
                    isGradient={true}
                    className="bg-gradient-to-r from-gray-800 via-gray-700 to-orange-600 bg-clip-text text-transparent"
                  />
                </h1>
                <h2 className="text-4xl md:text-5xl font-bold leading-tight text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]">
                  <AnimatedText 
                    text="RAPIDFIX." 
                    delay={1200}
                    letterDelay={100}
                    loopDelay={1500}
                  />
                </h2>
                <p className="text-2xl md:text-3xl font-semibold text-orange-500 mt-4">
                  WHEN ROADS STOP YOU, WE DON'T.
                </p>
              </div>
              <p className="text-xl text-muted-foreground">
                Connect instantly with verified local mechanics for roadside assistance. 
                Fast, reliable, and affordable support when you need it most.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/auth">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto text-lg h-14 px-8 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity shadow-lg"
                  >
                    Find a Mechanic
                  </Button>
                </Link>
                <Link to="/about">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto text-lg h-14 px-8"
                  >
                    Learn More
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <img
                src={heroImage}
                alt="Mechanic helping traveler"
                className="rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why Choose Team One Rupee?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Quick, reliable, and verified roadside assistance at your fingertips
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-2 hover:border-primary transition-all hover:shadow-xl">
              <CardContent className="pt-6 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <MapPin className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-semibold">Location-Based</h3>
                <p className="text-muted-foreground">
                  Find mechanics near you instantly using GPS. Get help from verified professionals within minutes.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary transition-all hover:shadow-xl">
              <CardContent className="pt-6 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Shield className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-semibold">Verified Mechanics</h3>
                <p className="text-muted-foreground">
                  All mechanics are verified with ID proof. Trust and safety guaranteed for every service.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary transition-all hover:shadow-xl">
              <CardContent className="pt-6 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Clock className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-semibold">Real-Time Tracking</h3>
                <p className="text-muted-foreground">
                  Track your mechanic's arrival in real-time. Stay updated with instant notifications.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary transition-all hover:shadow-xl">
              <CardContent className="pt-6 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <CreditCard className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-semibold">Secure Payments</h3>
                <p className="text-muted-foreground">
                  Pay safely through our secure payment gateway. Transparent pricing with no hidden charges.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary transition-all hover:shadow-xl">
              <CardContent className="pt-6 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Star className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-semibold">Rate & Review</h3>
                <p className="text-muted-foreground">
                  Share your experience and help others. Quality service backed by community ratings.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary transition-all hover:shadow-xl">
              <CardContent className="pt-6 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Wrench className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-semibold">Professional Service</h3>
                <p className="text-muted-foreground">
                  Expert mechanics for all vehicle types. Quality repairs and maintenance on the spot.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary to-accent">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-primary-foreground mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Join thousands of travelers who trust Team One Rupee for roadside assistance
          </p>
          <Link to="/auth">
            <Button
              size="lg"
              variant="secondary"
              className="text-lg h-14 px-8 hover:scale-105 transition-transform"
            >
              Sign Up Now
            </Button>
          </Link>
        </div>
      </section>

      {/* Testimonials Section */}
      <Testimonials />

      <Footer />
    </div>
  );
};

export default Home;
