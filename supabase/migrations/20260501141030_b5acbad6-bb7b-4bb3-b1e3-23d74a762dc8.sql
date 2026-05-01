-- Allow admins to view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow users to view their own role (if not already)
CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can insert roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update roles
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete roles
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all profiles (for user management UI)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
