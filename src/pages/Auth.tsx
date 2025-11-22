import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Camera, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Logo from "@/components/Logo";
import LoadingScreen from "@/components/LoadingScreen";

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error("Please select an image file");
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }
      
      setProfilePhoto(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const userType = formData.get("userType") as string;

    // Validate required fields
    if (!phone || phone.trim() === "") {
      toast.error("Phone number is required");
      setIsLoading(false);
      return;
    }

    if (!profilePhoto) {
      toast.error("Profile photo is required");
      setIsLoading(false);
      return;
    }

    try {
      // First, create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: name,
            role: userType,
            phone: phone,
          },
        },
      });

      if (authError) throw authError;

      // Check if email confirmation is required
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // User is already logged in (auto-confirmed)
        const userId = session.user.id;
        
        // Upload profile photo
        setUploadingPhoto(true);
        let photoUrl = "";
        
        try {
          const fileExt = profilePhoto.name.split(".").pop();
          const fileName = `${userId}/profile_photo_${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("profile-photos")
            .upload(fileName, profilePhoto, {
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from("profile-photos")
            .getPublicUrl(fileName);

          photoUrl = publicUrl;
        } catch (photoError: any) {
          console.error("Error uploading photo:", photoError);
          toast.error("Failed to upload profile photo. Please try again.");
          setIsLoading(false);
          setUploadingPhoto(false);
          return;
        } finally {
          setUploadingPhoto(false);
        }
        
        // Create profile entry with phone and photo
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            id: userId,
            email: session.user.email!,
            full_name: name,
            phone: phone,
            profile_photo: photoUrl,
            role: userType === "mechanic" ? "mechanic" : userType === "traveler" ? "user" : "user",
            status: "active",
          }, {
            onConflict: "id"
          });

        if (profileError) {
          console.warn("Profile creation error:", profileError);
          toast.error("Account created but profile update failed. Please update your profile manually.");
        } else {
          toast.success("Account created successfully! Redirecting...");
        }

        // Show loading screen before redirect
        setShowLoadingScreen(true);
        
        // Redirect based on role after loading screen
        setTimeout(() => {
          if (userType === "mechanic") {
            navigate("/mechanic");
          } else {
            navigate("/dashboard");
          }
          setShowLoadingScreen(false);
        }, 4000);
      } else {
        // Email confirmation required
        // Note: Photo upload will happen after email confirmation when user logs in
        // For now, we'll store the photo data in localStorage temporarily
        if (profilePhoto) {
          const reader = new FileReader();
          reader.onloadend = () => {
            localStorage.setItem('pending_profile_photo', reader.result as string);
            localStorage.setItem('pending_profile_photo_name', profilePhoto.name);
          };
          reader.readAsDataURL(profilePhoto);
        }
        
        toast.success("Account created! Please check your email to verify your account. After verification, your profile photo will be uploaded.");
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to sign up");
    } finally {
      setIsLoading(false);
      setUploadingPhoto(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check if there's a pending profile photo from signup (email confirmation flow)
      const pendingPhoto = localStorage.getItem('pending_profile_photo');
      const pendingPhotoName = localStorage.getItem('pending_profile_photo_name');
      
      if (pendingPhoto && pendingPhotoName) {
        try {
          // Convert data URL back to file
          const response = await fetch(pendingPhoto);
          const blob = await response.blob();
          const file = new File([blob], pendingPhotoName, { type: blob.type });
          
          // Upload photo
          const fileExt = file.name.split(".").pop();
          const fileName = `${authData.user.id}/profile_photo_${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("profile-photos")
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: true
            });

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from("profile-photos")
              .getPublicUrl(fileName);

            // Update profile with photo
            await supabase
              .from("profiles")
              .upsert({
                id: authData.user.id,
                profile_photo: publicUrl,
              }, {
                onConflict: "id"
              });

            // Clear pending photo
            localStorage.removeItem('pending_profile_photo');
            localStorage.removeItem('pending_profile_photo_name');
            
            toast.success("Profile photo uploaded successfully!");
          }
        } catch (photoError) {
          console.error("Error uploading pending photo:", photoError);
          // Don't block login if photo upload fails
        }
      }

      // Try fetching role from `user_roles` table and fall back to auth user metadata
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id)
        .single();

      let role = roleData?.role;

      if (roleError) {
        // Log the error but continue — there may simply be no row in `user_roles` yet
        console.warn("Error fetching role from user_roles table:", roleError);
      }

      // Fallback to role stored in auth user metadata (if available)
      if (!role) {
        role = (authData?.user as any)?.user_metadata?.role ?? (authData?.user as any)?.role ?? null;
      }

      // If we resolved a role from metadata but there was no DB row, persist it for future lookups
      if (!roleData && role) {
        const { error: upsertError } = await supabase
          .from("user_roles")
          .upsert([{ user_id: authData.user.id, role }], { onConflict: "user_id" });

        if (upsertError) {
          console.warn("Failed to upsert user_roles row:", upsertError);
        }
      }

      toast.success("Logged in successfully!");

      // MANDATORY: Request location permission before redirect (for all users)
      try {
        const { getLocation, isSecureContext } = await import("@/utils/geolocation");
        
        if (!isSecureContext()) {
          toast.warning("GPS location requires HTTPS. Location will be requested on dashboard.", {
            duration: 4000,
          });
        } else {
          // Try to get location immediately (non-blocking)
          getLocation({ timeout: 5000 }).catch(() => {
            // Location will be requested on dashboard if it fails here
            console.log("Location will be requested on dashboard");
          });
        }
      } catch (error) {
        // Location will be requested on dashboard
        console.log("Location will be requested on dashboard");
      }

      // Show loading screen before redirect
      setShowLoadingScreen(true);

      // Redirect based on resolved role after loading screen
      setTimeout(() => {
        if (role === "mechanic") {
          navigate("/mechanic");
        } else if (role === "admin") {
          navigate("/admin");
        } else {
          navigate("/dashboard");
        }
        setShowLoadingScreen(false);
      }, 4000);
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {showLoadingScreen && (
        <LoadingScreen
          duration={4000}
          onComplete={() => setShowLoadingScreen(false)}
        />
      )}
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary/30 to-background p-4">
        <div className="w-full max-w-md">
          <Link to="/" className="flex justify-center mb-8">
            <Logo size="lg" showText={true} />
          </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Welcome</CardTitle>
            <CardDescription>Sign in or create an account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      name="password"
                      type="password"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-primary to-accent"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name *</Label>
                    <Input
                      id="signup-name"
                      name="name"
                      type="text"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email *</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Phone Number *</Label>
                    <Input
                      id="signup-phone"
                      name="phone"
                      type="tel"
                      placeholder="+91 9876543210"
                      required
                      pattern="[+]?[0-9\s-]{10,15}"
                    />
                    <p className="text-xs text-muted-foreground">
                      Phone number is required for account verification
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password *</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-photo">Profile Photo *</Label>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="h-16 w-16">
                          <AvatarImage 
                            src={photoPreview || undefined} 
                            alt="Profile preview" 
                          />
                          <AvatarFallback>
                            <User className="h-8 w-8" />
                          </AvatarFallback>
                        </Avatar>
                        <label
                          htmlFor="profile-photo-upload"
                          className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors"
                        >
                          <Camera className="h-3 w-3" />
                          <input
                            id="profile-photo-upload"
                            name="profile-photo"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoChange}
                            required
                          />
                        </label>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">
                          {profilePhoto ? profilePhoto.name : "Click to upload your profile photo"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Max size: 5MB. JPG, PNG, or GIF
                        </p>
                        {uploadingPhoto && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <Loader2 className="h-3 w-3 inline animate-spin mr-1" />
                            Uploading...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userType">I am a *</Label>
                    <select
                      id="userType"
                      name="userType"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                    >
                      <option value="traveler">Traveler</option>
                      <option value="mechanic">Mechanic</option>
                    </select>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-primary to-accent"
                    disabled={isLoading || uploadingPhoto || !profilePhoto}
                  >
                    {isLoading || uploadingPhoto ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {uploadingPhoto ? "Uploading photo..." : "Creating account..."}
                      </>
                    ) : (
                      "Sign Up"
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    * Required fields
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
};

export default Auth;
