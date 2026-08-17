-- WEVSOCIAL Database Seed Migration 002
-- Pre-populates accounts, sports activities, and care providers
-- Default test password for all seeded users: "Password123!" (bcrypt hashed)
-- Hash for 'Password123!': $2a$10$wE9U634rC9gCknx6d3qR..sB9TjJ79zO4eC.Xw3Keqp98y1PjC5w6 (or generated via bcrypt)

INSERT INTO users (id, email, password_hash, role, first_name, last_name, avatar)
VALUES
  ('usr_admin_01', 'admin@wevsocial.com', '$2a$10$i2M.b3yGvH6mZc3R5E4TaeQ/h1E3hP7sE9U1xY8vJ3P.hO4FwJbvy', 'host_admin', 'Sarah', 'Connor', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'),
  ('usr_member_01', 'alex@wevsocial.com', '$2a$10$i2M.b3yGvH6mZc3R5E4TaeQ/h1E3hP7sE9U1xY8vJ3P.hO4FwJbvy', 'member', 'Alex', 'Rivera', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150'),
  ('usr_guest_01', 'guest@wevsocial.com', '$2a$10$i2M.b3yGvH6mZc3R5E4TaeQ/h1E3hP7sE9U1xY8vJ3P.hO4FwJbvy', 'guest', 'Guest', 'Visitor', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sports_activities (id, title, category, host_name, venue, start_time, end_time, capacity, booked_count, price_cents, lat, lng)
VALUES
  ('act_tennis_01', 'Sunset Clay Court Tennis Doubles', 'tennis', 'Coach Marcus', 'Grand Central Tennis Club, Court 3', CURRENT_TIMESTAMP + INTERVAL '2 hours', CURRENT_TIMESTAMP + INTERVAL '4 hours', 4, 3, 1500, 37.7749, -122.4194),
  ('act_bball_02', '3v3 Half-Court Basketball Pick-up', 'basketball', 'Jordan Bell', 'Mission Rec Center Gym A', CURRENT_TIMESTAMP + INTERVAL '5 hours', CURRENT_TIMESTAMP + INTERVAL '7 hours', 6, 2, 800, 37.7599, -122.4148),
  ('act_yoga_03', 'Sunrise Vinyasa Flow & Breathwork', 'yoga', 'Elena Vance', 'Dolores Park Hillside Lawn', CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '1 day 90 minutes', 20, 14, 1200, 37.7596, -122.4269),
  ('act_full_04', 'High-Intensity Futsal Tournament', 'football', 'Diego Silva', 'SOMA Indoor Arena Court 1', CURRENT_TIMESTAMP + INTERVAL '3 hours', CURRENT_TIMESTAMP + INTERVAL '5 hours', 10, 10, 2000, 37.7812, -122.4045),
  ('act_run_05', 'Bay Trail 10K Endurance Paced Run', 'running', 'Claire Dupont', 'Crissy Field Warming Hut', CURRENT_TIMESTAMP + INTERVAL '2 days', CURRENT_TIMESTAMP + INTERVAL '2 days 2 hours', 30, 8, 0, 37.8044, -122.4662),
  ('act_swim_06', 'Masters Open Water Swim Session', 'swimming', 'Capt. Soren', 'Aquatic Park Cove Pier', CURRENT_TIMESTAMP + INTERVAL '3 days', CURRENT_TIMESTAMP + INTERVAL '3 days 90 minutes', 12, 5, 1800, 37.8066, -122.4239)
ON CONFLICT (id) DO NOTHING;

INSERT INTO care_providers (id, name, specialty, bio, rating, review_count, hourly_rate_cents, exact_lat, exact_lng, exact_address, phone)
VALUES
  ('prov_care_01', 'Maria Sanchez, RN', 'Childcare (Infant/Toddler)', 'Certified pediatric nurse and CPR instructor with 9+ years experience caring for infants and toddlers in private homes.', 4.95, 48, 3200, 37.7654, -122.4312, '482 Castro St, San Francisco, CA 94114', '+1-415-555-0142'),
  ('prov_care_02', 'David Kim', 'After-School Care & Tutoring', 'Credentialed STEM teacher offering active sports coaching, homework help, and certified after-school childcare.', 4.88, 34, 2800, 37.7833, -122.4167, '820 Geary St, San Francisco, CA 94109', '+1-415-555-0198'),
  ('prov_care_03', 'Grace Thorne, CNA', 'Senior Eldercare & Mobility Support', 'Compassionate certified nursing assistant dedicated to companion care, medication reminders, and gentle physical therapy assistance.', 5.00, 62, 3500, 37.7502, -122.4181, '1294 Valencia St, San Francisco, CA 94110', '+1-415-555-0177'),
  ('prov_care_04', 'Hannah Lin', 'Special Needs & Sensory Support', 'Special Education specialist with extensive background in ASD behavioral support, calm routines, and engaging creative arts.', 4.92, 29, 3800, 37.7891, -122.4014, '201 Folsom St, San Francisco, CA 94105', '+1-415-555-0163')
ON CONFLICT (id) DO NOTHING;
