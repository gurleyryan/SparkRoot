// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2';
// @ts-ignore
Deno.serve(async (req)=>{
  // Ensure only service role can modify user roles
  // @ts-ignore
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  // @ts-ignore
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), serviceRoleKey);
  // Handle different HTTP methods
  switch(req.method){
    case 'POST':
      {
        const { userId, role } = await req.json();
        // Validate input
        if (!userId || !role) {
          return new Response(JSON.stringify({
            error: 'User ID and role are required'
          }), {
            status: 400
          });
        }
        // Allowed roles
        const validRoles = [
          'admin',
          'moderator',
          'user'
        ];
        if (!validRoles.includes(role)) {
          return new Response(JSON.stringify({
            error: 'Invalid role'
          }), {
            status: 400
          });
        }
        // Update user's app_metadata with role
        const { data, error } = await supabase.auth.admin.updateUserById(userId, {
          app_metadata: {
            role
          }
        });
        if (error) {
          return new Response(JSON.stringify({
            error: error.message
          }), {
            status: 500
          });
        }
        return new Response(JSON.stringify({
          message: 'Role updated successfully',
          user: data.user
        }), {
          status: 200
        });
      }
    default:
      return new Response('Method Not Allowed', {
        status: 405
      });
  }
});
