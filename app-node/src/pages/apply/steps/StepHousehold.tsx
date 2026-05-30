/**
 * Step: Household - Add/remove household members.
 */

import { useState } from "react"
import type { HouseholdMemberFormData } from "../../../lib/apply/types"

interface StepHouseholdProps {
  members: HouseholdMemberFormData[]
  onMembersChange: (members: HouseholdMemberFormData[]) => void
  onAddMember: (member: HouseholdMemberFormData) => void
  onRemoveMember: (index: number) => void
  onNext: () => void
  onPrevious: () => void
}

export function StepHousehold({
  members,
  onMembersChange,
  onAddMember,
  onRemoveMember,
  onNext,
  onPrevious,
}: StepHouseholdProps) {
  const [newMember, setNewMember] = useState<HouseholdMemberFormData>({
    firstName: "",
    lastName: "",
    DOB: "",
    relationship: "",
  })

  const handleAdd = () => {
    if (newMember.firstName && newMember.lastName) {
      onAddMember(newMember)
      setNewMember({ firstName: "", lastName: "", DOB: "", relationship: "" })
    }
  }

  const handleMemberUpdate = (index: number, field: keyof HouseholdMemberFormData, value: string) => {
    const updated = [...members]
    updated[index] = { ...updated[index], [field]: value }
    onMembersChange(updated)
  }

  return (
    <section aria-labelledby="step-household-heading">
      <h2 id="step-household-heading">Household Members</h2>
      <p>Add all people who will live in the unit (not including yourself).</p>

      {members.length > 0 && (
        <ul aria-label="Household members">
          {members.map((member, i) => (
            <li key={i}>
              <fieldset>
                <legend>Member {i + 1}</legend>

                <label htmlFor={`member-${i}-first`}>First Name</label>
                <input
                  id={`member-${i}-first`}
                  type="text"
                  value={member.firstName}
                  onChange={(e) => handleMemberUpdate(i, "firstName", e.target.value)}
                />

                <label htmlFor={`member-${i}-last`}>Last Name</label>
                <input
                  id={`member-${i}-last`}
                  type="text"
                  value={member.lastName}
                  onChange={(e) => handleMemberUpdate(i, "lastName", e.target.value)}
                />

                <label htmlFor={`member-${i}-dob`}>Date of Birth</label>
                <input
                  id={`member-${i}-dob`}
                  type="date"
                  value={member.DOB}
                  onChange={(e) => handleMemberUpdate(i, "DOB", e.target.value)}
                />

                <label htmlFor={`member-${i}-rel`}>Relationship</label>
                <input
                  id={`member-${i}-rel`}
                  type="text"
                  value={member.relationship}
                  onChange={(e) => handleMemberUpdate(i, "relationship", e.target.value)}
                />

                <button type="button" onClick={() => onRemoveMember(i)}>
                  Remove
                </button>
              </fieldset>
            </li>
          ))}
        </ul>
      )}

      <fieldset>
        <legend>Add a Household Member</legend>

        <label htmlFor="new-first">First Name *</label>
        <input
          id="new-first"
          type="text"
          value={newMember.firstName}
          onChange={(e) => setNewMember({ ...newMember, firstName: e.target.value })}
        />

        <label htmlFor="new-last">Last Name *</label>
        <input
          id="new-last"
          type="text"
          value={newMember.lastName}
          onChange={(e) => setNewMember({ ...newMember, lastName: e.target.value })}
        />

        <label htmlFor="new-dob">Date of Birth</label>
        <input
          id="new-dob"
          type="date"
          value={newMember.DOB}
          onChange={(e) => setNewMember({ ...newMember, DOB: e.target.value })}
        />

        <label htmlFor="new-rel">Relationship</label>
        <input
          id="new-rel"
          type="text"
          value={newMember.relationship}
          onChange={(e) => setNewMember({ ...newMember, relationship: e.target.value })}
        />

        <button type="button" onClick={handleAdd}>
          Add Member
        </button>
      </fieldset>

      <div>
        <button type="button" onClick={onPrevious}>Previous</button>
        <button type="button" onClick={onNext}>Next</button>
      </div>
    </section>
  )
}
