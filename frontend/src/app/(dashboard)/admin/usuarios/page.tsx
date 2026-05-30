'use client';

import { ErrorAlert } from '@/components/common/ErrorAlert';
import { getErrorMessage } from '@/lib/api';
import { useUsuarios } from './useUsuarios';
import { UsersCard } from './UsersCard';
import { CreateInvitationCard, InvitationsListCard } from './usuarios.parts';
import { AssistantGroupsCard, EditUserCard } from './usuarios.edit-cards';

export default function AdminUsuariosPage() {
  const {
    user,
    isAdmin,
    users,
    invitations,
    medicos,
    activeAdminCount,
    assistantGroups,
    isLoading,
    isLoadingInvitations,
    error,
    invitationsError,
    createForm,
    setCreateForm,
    createErrors,
    createdInvitation,
    createInvitationMutation,
    editingUser,
    setEditingUser,
    editForm,
    setEditForm,
    editErrors,
    updateUserMutation,
    toggleConfirmUser,
    setToggleConfirmUser,
    toggleActiveMutation,
    revokeInvitationMutation,
    resetPasswordMutation,
    generateTemporaryPassword,
    getInvitationStatus,
    startEdit,
    prefillAssistantForMedico,
  } = useUsuarios();

  if (!isAdmin) return null;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Usuarios</h1>
          <p className="page-header-description">Crea médicos y asistentes, y administra sus relaciones operativas.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorAlert message={getErrorMessage(error)} />
        </div>
      )}

      <CreateInvitationCard
        createForm={createForm}
        createErrors={createErrors}
        createdInvitation={createdInvitation}
        medicos={medicos}
        createInvitationMutation={createInvitationMutation}
        setCreateForm={setCreateForm}
      />

      <InvitationsListCard
        invitations={invitations}
        isLoadingInvitations={isLoadingInvitations}
        invitationsError={invitationsError}
        users={users}
        revokeInvitationMutation={revokeInvitationMutation}
        getInvitationStatus={getInvitationStatus}
      />

      <AssistantGroupsCard
        assistantGroups={assistantGroups}
        prefillAssistantForMedico={prefillAssistantForMedico}
        startEdit={startEdit}
      />

      <EditUserCard
        editingUser={editingUser}
        editForm={editForm}
        editErrors={editErrors}
        medicos={medicos}
        activeAdminCount={activeAdminCount}
        updateUserMutation={updateUserMutation}
        setEditingUser={setEditingUser}
        setEditForm={setEditForm}
      />

      <UsersCard
        users={users}
        isLoading={isLoading}
        currentUserId={user?.id}
        activeAdminCount={activeAdminCount}
        toggleConfirmUser={toggleConfirmUser}
        setToggleConfirmUser={setToggleConfirmUser}
        toggleActiveMutation={toggleActiveMutation}
        resetPasswordMutation={resetPasswordMutation}
        generateTemporaryPassword={generateTemporaryPassword}
        startEdit={startEdit}
      />
    </div>
  );
}
