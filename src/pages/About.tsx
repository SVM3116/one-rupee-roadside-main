import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import manojPhoto from "@/assets/Manoj Kumar V.jpg";
import arihantPhoto from "@/assets/Arihant V Hachchambali.jpg";
import bheemanagoudaPhoto from "@/assets/Bheemanagouda Biradar.jpg";
import bhagyashreePhoto from "@/assets/Bhagyashree.jpg";

const About = () => {
  const developers = [
    {
      name: "Manoj Kumar V",
      initials: "MK",
      year: "3rd Year CSBS",
      university: "VTU Belagavi",
      photo: manojPhoto,
    },
    {
      name: "Arihant V Hachchambali",
      initials: "AH",
      year: "3rd Year CSBS",
      university: "VTU Belagavi",
      photo: arihantPhoto,
    },
    {
      name: "Bheemanagouda Biradar",
      initials: "BB",
      year: "3rd Year CSBS",
      university: "VTU Belagavi",
      photo: bheemanagoudaPhoto,
    },
    {
      name: "Bhagyashree",
      initials: "B",
      year: "3rd Year CSBS",
      university: "VTU Belagavi",
      photo: bhagyashreePhoto,
    },
  ];

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
          </div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <h2 className="text-3xl font-bold">About Us</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                One Rupee RapidFix is an on-demand roadside mechanic assistance platform designed to help travellers 
                and vehicle owners during unexpected vehicle breakdowns. We instantly connect users with nearby verified 
                mechanics using real-time GPS detection — similar to how Swiggy or Zomato match users with partners, 
                but for emergency vehicle repair.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Our goal is to make roadside assistance fast, safe, and accessible across urban and rural areas without 
                subscriptions or long waiting times. Mechanics can easily toggle online/offline, accept requests, and 
                reach users quickly, ensuring smooth and reliable help anytime.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <h2 className="text-3xl font-bold">Mission</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                To provide stress-free, dependable roadside repair for everyone, everywhere.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <h2 className="text-3xl font-bold">Tagline</h2>
              <p className="text-2xl font-semibold text-orange-500">
                "When Roads Stop You, We Don't."
              </p>
            </CardContent>
          </Card>

          {/* Meet Our Developers Section */}
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold">Meet Our Developers</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {developers.map((developer, index) => (
                <Card
                  key={index}
                  className="transition-all duration-300 hover:scale-105 hover:shadow-lg cursor-pointer"
                >
                  <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
                    {/* Circular Avatar with Photo or Initials */}
                    {developer.photo ? (
                      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-orange-500 shadow-md">
                        <img 
                          src={developer.photo} 
                          alt={developer.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-2xl font-bold shadow-md">
                        {developer.initials}
                      </div>
                    )}
                    
                    {/* Name */}
                    <div>
                      <h3 className="text-lg font-bold text-foreground">
                        {developer.name}
                      </h3>
                    </div>
                    
                    {/* Role */}
                    <div>
                      <p className="text-sm text-orange-500 font-medium">
                        Developer
                      </p>
                    </div>
                    
                    {/* Year & University */}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {developer.year}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {developer.university}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default About;
