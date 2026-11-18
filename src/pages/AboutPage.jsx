import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import PublicNavbar from '../components/PublicNavbar'
import { useSeo } from '../utils/useSeo'
import './AboutPage.css'

export default function AboutPage() {
  useSeo({
    title: 'About Us — Our Story & Founders',
    description: 'Meet Ayushman and Ritika, the founder and cofounder of serveQ, and discover why we are building a better way to wait at clinics and salons.',
    canonical: 'https://www.serveq.tech/about',
    robots: 'index, follow',
  })

  return (
    <div className="about-page">
      <PublicNavbar />

      <div className="about-body">
        <section className="about-hero" aria-labelledby="about-title">
          <p className="about-eyebrow">Our story</p>
          <h1 id="about-title">Your place in line.<br /><span>Your time back.</span></h1>
          <p className="about-lead">We’re building serveQ because getting the care or service you need shouldn’t mean putting the rest of your day on hold.</p>
          <div className="about-hero-note"><span aria-hidden="true">↗</span><p>A little less waiting.<br />A little more living.</p></div>
        </section>

        <section className="about-story" aria-labelledby="about-gap-title">
          <div><p className="about-eyebrow">The gap we found</p><h2 id="about-gap-title">Finding a place was easy.<br />Knowing when was harder.</h2></div>
          <div className="about-prose">
            <p>You can look up a clinic, check a salon’s opening hours, and find your way there. But one important question often stays unanswered: how long will you actually have to wait?</p>
            <p>For customers, that uncertainty makes it hard to plan the day. For the people behind the counter, it means balancing walk-ins, appointments, and a steady stream of “When is my turn?”</p>
            <p>That’s the gap we set out to close. We wanted a clearer connection between the people waiting and the businesses serving them.</p>
          </div>
        </section>

        <section className="about-idea" aria-labelledby="about-idea-title">
          <div><p className="about-eyebrow">The idea behind serveQ</p><h2 id="about-idea-title">Keep your place.<br />Keep your day moving.</h2><p>Bring the queue onto your phone. See your position, follow an estimated wait, and plan around your turn. Give businesses a way to keep that information moving, too.</p><Link to="/how-it-works">See how serveQ works <ArrowRight size={17} aria-hidden="true" /></Link></div>
          <div className="about-principles">
            <div><span>01</span><h3>Clarity for customers</h3><p>A live view of your place in line, instead of another trip to the counter.</p></div>
            <div><span>02</span><h3>Control for businesses</h3><p>Queues, appointments, and staff availability in one place.</p></div>
            <div><span>03</span><h3>Room for real life</h3><p>More information to plan your visit, and more freedom to use your time.</p></div>
          </div>
        </section>

        <section className="about-team" aria-labelledby="about-team-title">
          <div className="about-team-heading"><div><p className="about-eyebrow">The people behind it</p><h2 id="about-team-title">Two people.<br />One shared purpose.</h2></div><p>Built around a simple belief: everyone’s time deserves a little more respect.</p></div>
          <div className="about-founders">
            <article className="about-founder"><div className="about-monogram" aria-hidden="true">A<span>serveQ / 01</span></div><div className="about-founder-caption"><h3>Ayushman</h3><p>Founder</p></div></article>
            <article className="about-founder about-founder-clay"><div className="about-monogram" aria-hidden="true">R<span>serveQ / 02</span></div><div className="about-founder-caption"><h3>Ritika</h3><p>Cofounder</p></div></article>
          </div>
        </section>

        <section className="about-invitation" aria-labelledby="about-invitation-title"><p className="about-eyebrow">What comes next</p><h2 id="about-invitation-title">A better wait starts here.</h2><p>Find your next clinic or salon, or bring serveQ to your business.</p><div><Link className="about-primary" to="/customers">Find a venue <ArrowRight size={17} aria-hidden="true" /></Link><Link to="/business">For businesses <ArrowRight size={17} aria-hidden="true" /></Link></div></section>
      </div>
    </div>
  )
}
