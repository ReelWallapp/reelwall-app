import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get user's collections first
    const { data: collections, error: collectionsReadError } = await admin
      .from('collections')
      .select('id')
      .eq('user_id', user.id);

    if (collectionsReadError) throw collectionsReadError;

    const collectionIds = (collections || []).map((c) => c.id);

    // Delete collection links
    if (collectionIds.length > 0) {
      const { error } = await admin
        .from('collection_catches')
        .delete()
        .in('collection_id', collectionIds);

      if (error) throw error;
    }

    // Delete user's collections
    {
      const { error } = await admin
        .from('collections')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    }

    // Delete user's catches
    {
      const { error } = await admin
        .from('catches')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    }

    // Delete user's profile
    {
      const { error } = await admin
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (error) throw error;
    }

    // Delete Supabase Auth user
    const { error: deleteUserError } =
      await admin.auth.admin.deleteUser(user.id);

    if (deleteUserError) throw deleteUserError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.log('delete-account error:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});