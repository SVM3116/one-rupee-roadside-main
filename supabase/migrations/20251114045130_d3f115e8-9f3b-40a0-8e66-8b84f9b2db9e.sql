-- Add 'traveler' and 'mechanic' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'traveler';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mechanic';

-- Update the handle_new_user function to properly handle the role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'user'::app_role)
  );
  
  -- Also add to user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'user'::app_role)
  );
  
  RETURN NEW;
END;
$function$;