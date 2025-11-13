-- Step 1: Disable the trigger temporarily
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: After creating the user via script, run this to create the profile:
-- (Replace USER_ID_HERE with the actual user ID from the script output)
-- INSERT INTO user_profiles (id, email, role, full_name) 
-- VALUES ('USER_ID_HERE', 'admin@gmail.com', 'admin', 'admin')
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- Step 3: Re-enable the trigger after creating the profile
-- CREATE TRIGGER on_auth_user_created
-- AFTER INSERT ON auth.users
-- FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


