package com.example.CodeChefProject.config;

import com.example.CodeChefProject.model.Event;
import com.example.CodeChefProject.model.Registration;
import com.example.CodeChefProject.repository.EventRepository;
import com.example.CodeChefProject.repository.RegistrationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Seeds a realistic campus CodeChef chapter calendar the first time the
 * application starts against an empty database. Everything is idempotent: the
 * seed only runs when the matching table is empty, so restarts keep user data.
 */
@Component
public class DataInitializer implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

	private final EventRepository eventRepository;
	private final RegistrationRepository registrationRepository;

	public DataInitializer(EventRepository eventRepository, RegistrationRepository registrationRepository) {
		this.eventRepository = eventRepository;
		this.registrationRepository = registrationRepository;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		if (eventRepository.count() == 0) {
			seedEvents();
		} else {
			log.info("Event table already populated ({} rows) - skipping event seed.", eventRepository.count());
		}

		if (registrationRepository.count() == 0) {
			seedRegistrations();
		} else {
			log.info("Registration table already populated ({} rows) - skipping registration seed.",
					registrationRepository.count());
		}
	}

	private void seedEvents() {
		LocalDate today = LocalDate.now();

		List<Event> events = List.of(
				new Event("CodeChef Campus Starters 101 (Rated Div 2)", "Rated Contest", today.plusDays(4),
						LocalTime.of(20, 0), "CodeChef Arena - Computer Lab 3",
						"The flagship campus edition of CodeChef Starters. Two hours, four problems, live rating "
								+ "changes and a global leaderboard. Div 2 is open to everyone above 1 star; Div 3 "
								+ "coders can request a practice-mode mirror from the chapter mentors.",
						true),
				new Event("Dynamic Programming Masterclass", "DSA Workshop", today.plusDays(8),
						LocalTime.of(17, 30), "Seminar Hall B (Block C)",
						"A hands-on 2 hour workshop on the DP patterns that actually show up in contests: knapsack, "
								+ "LIS, bitmask DP, digit DP and matrix exponentiation. Bring a laptop - every "
								+ "pattern ends with a CodeChef practice problem set.",
						false),
				new Event("ICPC Regional Mock Qualifier", "ICPC Prep", today.plusDays(12),
						LocalTime.of(9, 30), "Innovation Lab, 4th Floor",
						"Team contest simulation of the ICPC regional qualifier. Three members per team, five hours, "
								+ "ten problems and the exact scoring rules of the real qualifier. The top two campus "
								+ "teams get travel sponsorship for the onsite regionals.",
						false),
				new Event("Freshers Coding Cup (Div 4)", "Rated Contest", today.plusDays(15),
						LocalTime.of(18, 0), "Central Auditorium",
						"Beginner friendly contest built for first year students. Only loops, arrays, strings and "
								+ "basic maths - zero prior contest experience needed. Every participant gets a "
								+ "CodeChef starter kit and the top 10 win chapter goodies.",
						false),
				new Event("Campus CodeChef Hackathon 2026", "Hackathon", today.plusDays(21),
						LocalTime.of(9, 0), "Innovation Lab & Tinkering Studio",
						"36 hour open innovation hackathon with problem statements from the chapter's industry "
								+ "partners. Teams of 2-4, judged on code quality, a working demo and impact. Winners "
								+ "present at the CodeChef Campus Chapter Showcase.",
						true),
				new Event("Git & Open Source Sprint", "Tech Talk", today.plusDays(26),
						LocalTime.of(16, 0), "Computer Lab 1",
						"Ship your first pull request! Live walkthrough of branching, rebase vs merge, writing clean "
								+ "commit messages and finding beginner friendly GitHub issues. Ends with a guided "
								+ "open source contribution sprint for the whole chapter.",
						false));

		eventRepository.saveAll(events);
		log.info("Seeded {} campus CodeChef events.", events.size());
	}

	private void seedRegistrations() {
		Map<String, Event> byName = eventRepository.findAllByOrderByEventDateAscEventTimeAsc().stream()
				.collect(Collectors.toMap(Event::getName, Function.identity(), (first, second) -> first));

		Event starters = byName.get("CodeChef Campus Starters 101 (Rated Div 2)");
		Event dpMasterclass = byName.get("Dynamic Programming Masterclass");
		Event freshersCup = byName.get("Freshers Coding Cup (Div 4)");
		Event hackathon = byName.get("Campus CodeChef Hackathon 2026");
		Event gitSprint = byName.get("Git & Open Source Sprint");

		List<Registration> registrations = List.of(
				registration("Arjun Mehta", "arjun.mehta@college.edu", "CSE - 2nd Year", "+91 98200 11223",
						starters, 2, 5),
				registration("Sneha Kulkarni", "sneha.kulkarni@college.edu", "IT - 3rd Year", "+91 98330 44551",
						starters, 3, 1),
				registration("Rohan Bajaj", "rohan.bajaj@college.edu", "AIML - 1st Year", "+91 99870 22114",
						starters, 4, 9),
				registration("Fatima Sheikh", "fatima.sheikh@college.edu", "CSE - 4th Year", "+91 90040 77812",
						starters, 1, 13),
				registration("Kabir Nair", "kabir.nair@college.edu", "CSE - 2nd Year", "+91 91234 56780",
						dpMasterclass, 2, 3),
				registration("Ananya Rao", "ananya.rao@college.edu", "ECE - 3rd Year", "+91 93456 12309",
						dpMasterclass, 5, 8),
				registration("Devansh Gupta", "devansh.gupta@college.edu", "IT - 2nd Year", "+91 95678 33441",
						dpMasterclass, 1, 10),
				registration("Ishan Verma", "ishan.verma@college.edu", "CSE - 1st Year", "+91 97001 55667",
						freshersCup, 3, 2),
				registration("Meera Pillai", "meera.pillai@college.edu", "AIML - 1st Year", "+91 98450 99881",
						freshersCup, 4, 6),
				registration("Tanmay Joshi", "tanmay.joshi@college.edu", "Mechanical - 1st Year", "+91 99012 33445",
						freshersCup, 6, 4),
				registration("Prisha Bansal", "prisha.bansal@college.edu", "CSE - 1st Year", "+91 90011 22334",
						freshersCup, 2, 12),
				registration("Aditya Krishnan", "aditya.krishnan@college.edu", "CSE - 3rd Year", "+91 98111 22335",
						hackathon, 5, 2),
				registration("Nandini Sharma", "nandini.sharma@college.edu", "IT - 4th Year", "+91 98222 33446",
						hackathon, 7, 7),
				registration("Yash Thakur", "yash.thakur@college.edu", "ECE - 2nd Year", "+91 98333 44557",
						hackathon, 3, 11),
				registration("Simran Kaur", "simran.kaur@college.edu", "AIML - 3rd Year", "+91 98444 55668",
						hackathon, 1, 16),
				registration("Vivaan Deshpande", "vivaan.deshpande@college.edu", "CSE - 2nd Year", "+91 98555 66779",
						gitSprint, 2, 1));

		registrationRepository.saveAll(registrations);
		log.info("Seeded {} sample student registrations.", registrations.size());
	}

	private Registration registration(String name, String email, String college, String phone, Event event,
			int daysAgo, int hoursAgo) {
		Registration registration = new Registration(name, email, college, phone, event);
		registration.setRegisteredAt(LocalDateTime.now().minusDays(daysAgo).minusHours(hoursAgo));
		return registration;
	}
}
