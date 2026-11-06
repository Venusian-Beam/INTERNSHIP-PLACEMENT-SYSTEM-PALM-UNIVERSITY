<?php

namespace App\Modules\Identity\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\Identity\Models\Invitation;
use App\Modules\Identity\Notifications\IdentityMail;
use App\Support\Audit;
use App\Support\Outbox;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** FR-A4/A8 (Head only, enforced by the route's role middleware). */
class StaffAccountController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::whereIn('role', User::PRIVILEGED)->orderBy('role')->orderBy('name')
            ->get(['id', 'name', 'email', 'role', 'is_active', 'last_login_at']);
        $invites = Invitation::whereNull('accepted_at')->where('expires_at', '>', now())->latest()
            ->get(['id', 'name', 'email', 'role', 'expires_at', 'created_at']);

        return response()->json(['users' => $users, 'invitations' => $invites]);
    }

    public function invite(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:190'],
            'role' => ['required', Rule::in(['staff', 'head', 'president'])],
        ]);
        $email = strtolower(trim($data['email']));
        if (User::where('email', $email)->exists()) {
            throw ValidationException::withMessages(['email' => 'An account already exists for this email.']);
        }
        if (str_ends_with($email, '@'.config('placement.student_email_domain'))) {
            throw ValidationException::withMessages(['email' => 'Student addresses cannot be invited as staff.']);
        }

        Invitation::whereNull('accepted_at')->where('email', $email)->update(['expires_at' => now()]); // supersede older invites
        $token = Str::random(64);
        $days = config('placement.invitation_ttl_days');
        $invite = Invitation::create([
            'email' => $email, 'name' => $data['name'], 'role' => $data['role'],
            'token_hash' => hash('sha256', $token), 'expires_at' => now()->addDays($days), 'invited_by' => $request->user()->id,
        ]);
        $url = config('placement.frontend_url').'/accept-invite?token='.$token;
        Outbox::send($email, IdentityMail::invitation($data['name'], $data['role'], $url, $days), 'invite');
        Audit::log('staff.invited', $invite, ['email' => $email, 'role' => $data['role']]);

        return response()->json(['message' => "Invitation sent to {$email}."], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        if (! in_array($user->role, User::PRIVILEGED, true)) {
            abort(404);
        }
        if ($user->is($request->user())) {
            throw ValidationException::withMessages(['is_active' => 'You cannot change your own account.']);
        }

        $user->update(['is_active' => $data['is_active']]);
        if (! $data['is_active']) {
            $user->tokens()->delete(); // sign out immediately
        }
        Audit::log($data['is_active'] ? 'staff.reactivated' : 'staff.deactivated', $user, ['role' => $user->role]);

        return response()->json(['message' => $data['is_active'] ? 'Account reactivated.' : 'Account deactivated.']);
    }
}
