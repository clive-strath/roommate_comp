A Preference-Based Hostel Roommate Matching and Conflict Tracking System for University Students
## Functional Requirements Table
## Student Resident Advisor Administrator System
INPUT Student registers
account
## Resident Advisor
logs into the
system
Admin logs into the
system

Student logs into
the system
## Resident Advisor
logs out of the
system
Admin logs out of
the system

Student logs out of
the system
## Resident Advisor
logs a conflict
report
Admin creates a
## Resident Advisor
account

Student requests a
password reset
## Resident Advisor
marks a conflict
as resolved
Admin creates
another Admin
account

Student submits
wake time
preference
Admin disables a
student account

Student submits
sleep time
preference
Admin disables a
## Resident Advisor
account

Student submits
noise tolerance
preference
Admin initiates
roommate
assignment
generation

Student submits
cleanliness level
preference
Admin selects the
semester for
assignment

Student submits
guest policy
preference
Admin selects the
hostel block for
assignment

Student submits
bathroom schedule
preference
Admin confirms the
generated roommate
pairs

Student submits
additional
preference notes
Admin manually
overrides a
roommate
assignment

Student updates an
existing preference
submission
Admin cancels a
roommate
assignment

Student updates
personal profile
information
Admin adds a new
hostel room


## Student Resident Advisor Administrator System
Student views own
conflict records
Admin updates
hostel room details

Student searches
for own
assignment details
Admin deactivates a
hostel room

Student submits a
conflict
Admin searches for a
student by name

Admin searches for a
student by student
number

Admin filters
students by hostel
block

Admin filters
assignments by
semester

Admin overrides a
student preference
record

Admin updates a
student profile

Admin closes a
conflict record

PROCESS    System validates
student registration
fields
System checks
email uniqueness
on registration
System checks
student number
uniqueness on
registration
System hashes the
student password
before storage
System verifies
credentials at login
System generates a
JWT access token
on successful login

## Student Resident Advisor Administrator System
System embeds the
user role in the
JWT token payload
System validates
the JWT token on
every protected
request
System enforces
role-based access
control on routes
System enforces
ownership check
on student-level
resources
System expires the
JWT token after
the defined
duration
System generates a
password reset
token
System validates
the password reset
token expiry
System validates
preference form
inputs
System calculates
the wake-time
compatibility sub-
score
System calculates
the sleep-time
compatibility sub-
score
System calculates
the noise-tolerance
compatibility sub-
score
System calculates
the cleanliness
compatibility sub-
score
System calculates
the guest-policy

## Student Resident Advisor Administrator System
compatibility sub-
score
System calculates
the bathroom-
schedule
compatibility sub-
score
System aggregates
sub-scores into an
overall
compatibility score
System classifies
the compatibility
level (Excellent /
## Good / Caution /
## Poor)
System identifies
students without
submitted
preferences
System retrieves all
unassigned
students for the
selected semester
System calculates
compatibility
scores for all
possible student
pairs
System ranks
candidate pairs by
compatibility score
System allocates
highest-scoring
pairs to available
rooms
System flags pairs
with a
compatibility score
below 40%
System prevents
double-assignment
of a student to two
rooms

## Student Resident Advisor Administrator System
System prevents
assignment of a
student without
preference data
System logs all
assignment create,
update, and cancel
events
System logs all
conflict create and
update events
System records
timestamp and
actor for every data
change
OUTPUT Student receives
registration
confirmation
## Resident Advisor
receives the RA
dashboard after
login
Admin receives the
administrator
dashboard after login
System displays
the student
dashboard after
successful login
Student receives a
preference
completion prompt
if no preferences
exist
## Resident Advisor
receives the list of
students in the
assigned
block/floor
Admin receives the
list of all registered
students
System displays
the proposed
roommate pairs
before
confirmation
Student receives
current roommate
assignment details
## Resident Advisor
receives all active
assignments in the
assigned
block/floor
Admin receives the
detailed student
profile on request
System displays
compatibility score
and classification
for each pair
Student receives
roommate
compatibility
profile
## Resident Advisor
receives the
conflict queue for
the assigned
block/floor
Admin receives the
flagged low-
compatibility pairs
System displays
flagged low-
compatibility pairs
Student receives
own preference
summary
## Resident Advisor
receives conflict
details for a
selected record
Admin receives all
confirmed
assignments for the
selected semester
System displays
error messages on
invalid form
submissions
Student receives
own conflict
history
Admin receives
room occupancy
status
System displays
success
confirmation after
preference
submission
Student receives
success
Admin receives all
conflict records


## Student Resident Advisor Administrator System
confirmation after
preference
submission
across all
blocks/floors
Admin receives the
list of students
without preference
data

Admin receives the
audit trail of
assignment changes

STORAGE    System stores the
student registration
record
System stores the
hashed student
password
System stores
student profile
updates
System stores
student account
status (active /
disabled)
System stores the
administrator
account record
System stores the
## Resident Advisor
account record
System stores the
role assignment for
each admin user
System stores the
hostel block/floor
assignment for
each Resident
## Advisor
System stores the
created_by
reference for every
admin account
System stores the
student wake time
preference value

## Student Resident Advisor Administrator System
System stores the
student sleep time
preference value
System stores the
student noise
tolerance
preference value
System stores the
student cleanliness
level preference
value
System stores the
student guest
policy preference
value
System stores the
student bathroom
schedule
preference value
System stores the
student additional
notes preference
text
System stores the
preference
submission
timestamp
System stores the
hostel room record
(number, block,
capacity, status)
System stores the
roommate
assignment record
System stores the
compatibility score
for each
assignment
System stores the
semester and
academic year for
each assignment
System stores the
assignment status
## (proposed /

## Student Resident Advisor Administrator System
confirmed /
cancelled)
System stores the
manual override
flag and reason for
overridden
assignments
System stores the
assignment
confirmation
timestamp and
confirming admin
System stores the
conflict report
record
System stores the
conflict type,
severity, and
description
System stores the
conflict status
(open / in progress
/ resolved)
System stores the
conflict resolution
notes
System stores the
reporter identity
and timestamp for
each conflict
System stores audit
log entries for
assignment events
System stores audit
log entries for
conflict events
System stores
password reset
tokens with expiry
timestamps
REPORTING Student receives
own assignment
history report
## Resident Advisor
receives conflict
summary for the
assigned block
Admin receives full
assignment summary
for the selected
semester
System generates
the compatibility
score report for a
selected pair

## Student Resident Advisor Administrator System
## Resident Advisor
receives conflict
breakdown by
type for the
assigned block
Admin receives the
list of unmatched
students for the
selected semester
System generates
the list of flagged
low-compatibility
assignments
Admin receives
room occupancy
report by block
System generates
the conflict
breakdown by type
Admin receives
conflict summary
across all blocks for
the selected semester
System generates
the report of
assignments with
subsequent
conflicts
Admin receives the
list of students who
have not submitted
preferences
System generates
the audit trail
report for all
assignment
changes