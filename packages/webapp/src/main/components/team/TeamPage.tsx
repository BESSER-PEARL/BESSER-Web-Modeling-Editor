import React, { useState } from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import styled from 'styled-components';
import { Link } from 'react-router-dom';

const PageContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow-x: hidden;
  /* Account for the fixed navbar */
  padding-top: 60px;
`;

const HeroSection = styled.div`
  padding: 4rem 2rem;
  text-align: center;
  color: white;
`;

const HeroTitle = styled.h1`
  font-size: 3.5rem;
  font-weight: 800;
  margin-bottom: 1rem;
  background: linear-gradient(45deg, #fff, #e3f2fd);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const HeroSubtitle = styled.p`
  font-size: 1.3rem;
  margin-bottom: 3rem;
  opacity: 0.9;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
`;

const Section = styled.div`
  padding: 4rem 2rem;
  
  &.project {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(20px);
  }
  
  &.team {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(20px);
  }
  
  &.publications {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(20px);
  }
  
  &.contact {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(20px);
  }
`;

const SectionTitle = styled.h2`
  font-size: 2.5rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 3rem;
  color: white;
`;

const ProjectCard = styled(Card)`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 2rem;
  height: 100%;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    background: rgba(255, 255, 255, 1);
  }
`;

const TeamMemberCard = styled(Card)`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 1.5rem;
  height: 100%;
  text-align: center;
  transition: all 0.3s ease;
  cursor: pointer;
  
  &:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    background: rgba(255, 255, 255, 1);
  }
`;

const MemberPhoto = styled.img`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 1rem;
  border: 3px solid #667eea;
`;

const MemberName = styled.h5`
  font-weight: 700;
  color: #333;
  margin-bottom: 0.5rem;
`;

const MemberRole = styled.p`
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
  margin-bottom: 1rem;
`;

const ReadMoreButton = styled.button`
  background: none;
  border: none;
  color: #667eea;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  
  &:hover {
    color: #764ba2;
  }
`;

const ExpandedDescription = styled.div`
  background: rgba(102, 126, 234, 0.1);
  border-radius: 10px;
  padding: 1rem;
  margin-top: 1rem;
  border-left: 3px solid #667eea;
  
  p {
    color: #555;
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0;
  }
  
  button {
    background: none;
    border: none;
    color: #667eea;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    margin-top: 0.5rem;
    padding: 0;
    text-decoration: underline;
    
    &:hover {
      color: #764ba2;
    }
  }
`;

const PublicationsCard = styled(Card)`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 2rem;
  margin-bottom: 2rem;
`;

const PublicationItem = styled.li`
  margin-bottom: 1.5rem;
  line-height: 1.6;
  
  strong {
    display: block;
    margin-bottom: 0.5rem;
    color: #333;
  }
  
  a {
    color: #667eea;
    text-decoration: none;
    font-weight: 600;
    
    &:hover {
      text-decoration: underline;
      color: #764ba2;
    }
  }
`;

const ContactCard = styled(Card)`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 3rem;
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
`;

const ContactLink = styled.a`
  color: #667eea;
  text-decoration: none;
  font-size: 1.2rem;
  font-weight: 600;
  
  &:hover {
    text-decoration: underline;
    color: #764ba2;
  }
`;

const InstallButton = styled(Button)`
  padding: 12px 30px;
  font-weight: 600;
  border-radius: 12px;
  border: 2px solid white;
  background: transparent;
  color: white;
  transition: all 0.3s ease;
  margin-top: 2rem;
  
  &:hover {
    background: white;
    color: #667eea;
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  }
`;

const teamMembers = [
  {
    name: "Jordi Cabot",
    image: "/img/portfolio/Jordi.jpg",
    description: "FNR Pearl Chair and head of the Software Engineering RDI Unit at LIST. Prof. Jordi Cabot is leading research in model-driven engineering, low-code platforms, and intelligent software development. His work focuses on democratizing software creation through advanced modeling techniques and automated code generation. He has published extensively in top-tier conferences and journals, with over 200 scientific publications. Currently, he's spearheading the BESSER project, which aims to revolutionize how we build smart software systems."
  },
  {
    name: "Jean-Sebastien SOTTET",
    image: "/img/portfolio/Jean.jpg", 
    description: "Researcher focusing on model-driven approaches for no-code applications. Jean-Sebastien specializes in user interface engineering, model-driven development, and human-computer interaction. His research contributes to making software development more accessible to non-technical users through innovative modeling approaches and visual programming environments. He has extensive experience in developing tools that bridge the gap between technical and non-technical stakeholders in software projects."
  },
  {
    name: "Pierre BRIMONT",
    image: "/img/portfolio/Piere.jpg",
    description: "Studying Local Digital Twins software architecture. Pierre is working on cutting-edge research in digital twin technologies, specifically focusing on local implementations that can operate in distributed environments. His work involves developing architectures that enable real-time synchronization between physical systems and their digital counterparts, with applications in IoT, manufacturing, and smart city infrastructure."
  },
  {
    name: "Ivan David ALFONSO DIAZ",
    image: "/img/portfolio/Ivan.jpg",
    description: "Postdoctoral Researcher specializing in MDE and low-code methodologies. Ivan David brings expertise in model-driven engineering, domain-specific languages, and software product lines. His research focuses on developing methodologies that enable rapid prototyping and deployment of software solutions. He has contributed to several open-source projects and has experience in both academic research and industrial applications of low-code platforms."
  },
  {
    name: "Marcos GOMEZ VAZQUEZ",
    image: "/img/portfolio/Marcos.jpg",
    description: "Software Engineer working on BESSER Bot Framework. Marcos is developing conversational AI systems and chatbot frameworks that integrate with the BESSER platform. His work involves natural language processing, machine learning, and user experience design for conversational interfaces. He's particularly interested in creating bots that can assist in software development tasks and provide intelligent support for low-code environments."
  },
  {
    name: "Armen Sulejmani",
    image: "/img/portfolio/Armen.png",
    description: "Extending BESSER with REST API capabilities. Armen is focused on developing the API infrastructure that enables BESSER to integrate with external systems and services. His work involves designing scalable REST APIs, implementing authentication and authorization systems, and ensuring seamless integration with cloud platforms. He's also working on developing deployment automation tools that support multi-cloud environments."
  },
  {
    name: "Aaron CONRARDY",
    image: "/img/portfolio/Aaron.jpg",
    description: "Developer of Besser-Bot-Framework and BESSER platform. Aaron is a core contributor to the BESSER ecosystem, working on both the bot framework and the main platform. His expertise spans full-stack development, DevOps, and platform architecture. He's responsible for implementing many of the core features that make BESSER a powerful low-code solution, including the visual modeling tools and code generation engines."
  },
  {
    name: "Fitash UL HAQ",
    image: "/img/portfolio/fitash.jpg",
    description: "Working on verification activities for BESSER. Fitash specializes in software verification, testing methodologies, and quality assurance for low-code platforms. His research focuses on developing automated testing frameworks that can verify the correctness of generated code and ensure that low-code applications meet quality standards. He's also working on formal verification techniques for model-driven software development."
  },
  {
    name: "Faima Abbasi",
    image: "/img/portfolio/faima.jpg",
    description: "PhD Fellow focusing on Digital Twins Definition Language. Faima is developing domain-specific languages for defining and managing digital twins. Her research involves creating modeling languages that can capture the complex relationships between physical systems and their digital representations. She's working on tools that enable non-experts to create and maintain digital twin models for various industrial applications."
  },
  {
    name: "Atefeh Nirumand",
    image: "/img/portfolio/Atefeh_Nirumand.jpg",
    description: "Mobile application development and security analysis. Atefeh specializes in developing secure mobile applications using low-code approaches. Her research covers mobile security, privacy protection, and secure code generation for mobile platforms. She's working on frameworks that can automatically generate secure mobile applications while ensuring compliance with privacy regulations and security best practices."
  },
  {
    name: "Adem AIT-MIMOUNE FONOLLA",
    image: "/img/portfolio/adem.jpg",
    description: "PhD student working on software engineering topics. Adem is researching advanced software engineering methodologies, with a focus on improving development processes through automation and intelligent tooling. His work involves studying how AI and machine learning can be integrated into software development workflows to improve productivity and code quality. He's particularly interested in code analysis and automated refactoring techniques."
  },
  {
    name: "Daniele Pagani",
    image: "/img/portfolio/daniele.jpg",
    description: "Lead Partnership Officer responsible for dissemination and technology transfer. Daniele manages relationships with industry partners and oversees the commercialization of research results. His role involves identifying opportunities for technology transfer, managing collaborative projects with industry, and ensuring that research outcomes have real-world impact. He has extensive experience in project management and business development in the technology sector."
  },
  {
    name: "Nadia DAOUDI",
    image: "/img/portfolio/nadia.png",
    description: "Junior R&T Associate focusing on Machine Learning for Software Security. Nadia is working on applying machine learning techniques to improve software security in low-code environments. Her research involves developing AI models that can detect security vulnerabilities in generated code and suggest improvements. She's also working on automated security testing tools that can be integrated into the BESSER platform."
  },
  {
    name: "Mauro DALLE LUCCA TOSI",
    image: "/img/portfolio/mauro.png",
    description: "Research Engineer specialized in data-driven machine learning solutions. Mauro develops machine learning models and data analytics solutions that enhance the capabilities of the BESSER platform. His work involves creating intelligent features such as automated code completion, pattern recognition in models, and predictive analytics for software development. He has expertise in deep learning, natural language processing, and computer vision."
  },
  {
    name: "Renzo Degiovanni",
    image: "/img/portfolio/renzo.png",
    description: "Senior R&T Associate focusing on software analysis and engineering. Renzo brings extensive experience in software analysis, program comprehension, and software maintenance. His research focuses on developing tools that can automatically analyze and understand software systems, particularly in the context of low-code platforms. He's working on techniques for reverse engineering, code similarity analysis, and automated documentation generation."
  }
];

export const TeamPage: React.FC = () => {
  const [expandedMembers, setExpandedMembers] = useState<Set<number>>(new Set());

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedMembers);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedMembers(newExpanded);
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <PageContainer>
      <HeroSection>
        <HeroTitle>BESSER</HeroTitle>
        <HeroSubtitle>
          A low-modeling low-code open-source platform. BESSER (Building bEtter Smart Software fastER) is funded thanks to an FNR Pearl grant led by the{' '}
          <a 
            href="https://www.list.lu/" 
            style={{color: '#e3f2fd', textDecoration: 'underline'}}
          >
            Luxembourg Institute of Science and Technology
          </a>{' '}
          with the participation of the{' '}
          <a 
            href="https://www.uni.lu/snt-en/" 
            style={{color: '#e3f2fd', textDecoration: 'underline'}}
          >
            SnT/University of Luxembourg
          </a>{' '}
          and open to all your contributions!
        </HeroSubtitle>
      </HeroSection>

      <Section className="project">
        <Container>
          <SectionTitle>Project</SectionTitle>
          <Row>
            <Col lg={6} className="mb-4">
              <ProjectCard>
                <p>
                  BESSER is an FNR-funded PEARL project that stands for BEtter Smart Software fastER (BESSER) - An Intelligent low-code infrastructure for smart software. BESSER is hosted via a joint structural collaboration lead by{' '}
                  <a href="https://www.list.lu/" style={{color: '#667eea', textDecoration: 'underline'}}>LIST</a> and with the participation of{' '}
                  <a href="https://www.uni.lu/snt-en/" style={{color: '#667eea', textDecoration: 'underline'}}>SnT/UL</a>, it has the aim to combine both strategic research and applied research.
                  The results of BESSER will have a strong scientific, technical and economic impact by expanding the number of potential smart software creators, increasing the quality and reducing the time-to-market for this type of software.
                </p>
              </ProjectCard>
            </Col>
            <Col lg={6} className="mb-4">
              <ProjectCard>
                <p>
                  This project can democratize the creation of smart software, a key benefit in the current developers shortage. Moreover, by simplifying the specification and testing of ethical concerns, BESSER can also play a role in the fair use of AI in software, a major societal challenge. Overall, I strongly believe BESSER will significantly improve the competitiveness of Luxembourgian and, in general, European companies in the global market.
                </p>
              </ProjectCard>
            </Col>
          </Row>
          <div style={{textAlign: 'center'}}>
            <InstallButton 
              as="a" 
              href="https://besser.readthedocs.io/en/latest/installation.html"
              target="_blank"
            >
              📥 Installation Instructions
            </InstallButton>
          </div>
        </Container>
      </Section>

      <Section className="team">
        <Container>
          <SectionTitle>Team</SectionTitle>
          <Row>
            {teamMembers.map((member, index) => (
              <Col lg={3} md={4} sm={6} className="mb-4" key={index}>
                <TeamMemberCard>
                  <MemberPhoto 
                    src={member.image} 
                    alt={member.name}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = `data:image/svg+xml;base64,${btoa(`<svg width="120" height="120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#f0f0f0" rx="60"/><circle cx="60" cy="45" r="15" fill="#ccc"/><ellipse cx="60" cy="85" rx="25" ry="20" fill="#ccc"/></svg>`)}`;
                    }}
                  />
                  <MemberName>{member.name}</MemberName>
                  <MemberRole>
                    {expandedMembers.has(index) ? member.description : truncateText(member.description)}
                    {member.description.length > 100 && (
                      <ReadMoreButton 
                        onClick={() => toggleExpanded(index)}
                        style={{ display: 'block', marginTop: '0.5rem' }}
                      >
                        {expandedMembers.has(index) ? 'Show Less' : 'Read More'}
                      </ReadMoreButton>
                    )}
                  </MemberRole>
                </TeamMemberCard>
              </Col>
            ))}
          </Row>
        </Container>
      </Section>

      <Section className="publications">
        <Container>
          <SectionTitle>Publications</SectionTitle>
          
          <PublicationsCard>
            <h3 style={{color: '#667eea', textAlign: 'center', marginBottom: '2rem'}}>Book(s)</h3>
            <div style={{textAlign: 'center'}}>
              <h4>
                <a href="https://lowcode-book.com/" style={{color: '#333', textDecoration: 'none', fontWeight: '600'}}>
                  The low-code handbook
                </a>
              </h4>
              <p style={{color: '#666', fontStyle: 'italic'}}>
                Learn how to unlock faster and better software development with low-code solutions
              </p>
            </div>
          </PublicationsCard>

          <PublicationsCard>
            <h3 style={{color: '#667eea', textAlign: 'center', marginBottom: '1rem'}}>Scientific Publications</h3>
            <h4 style={{color: '#333', textAlign: 'center', marginBottom: '2rem'}}>2024</h4>
            
            <h5 style={{color: '#667eea', marginBottom: '1.5rem'}}>Conference Papers</h5>
            <ol style={{paddingLeft: '1.5rem'}}>
              <PublicationItem>
                <strong>
                  <a href="https://doi.org/10.1007/978-3-031-71246-3_5">
                    Extending a Low-Code Tool with Multi-cloud Deployment Capabilities (Received Best Paper Award)
                  </a><br />
                  Fitash Ul Haq, Iván Alfonso, Armen Sulejmani and Jordi Cabot
                </strong>
                In Proceedings of the 18th European Conference on Software Architecture (ECSA 2024).
              </PublicationItem>
              
              <PublicationItem>
                <strong>
                  <a href="https://doi.org/10.1145/3646548.3676599">
                    Exploring the Use of Software Product Lines for the Combination of Machine Learning Models (Received Best Paper Award)
                  </a><br />
                  Marcos Gomez-Vazquez and Jordi Cabot
                </strong>
                In Proceedings of the 28th ACM International Systems and Software Product Line Conference (SPLC 2024).
              </PublicationItem>
              
              <PublicationItem>
                <strong>
                  <a href="https://doi.org/10.1145/3640794.3665577">
                    Automatic Generation of Conversational Interfaces for Tabular Data Analysis
                  </a><br />
                  Marcos Gomez-Vazquez, Jordi Cabot, and Robert Clarisó
                </strong>
                In Proceedings of the 6th ACM Conference on Conversational User Interfaces (CUI '24).
              </PublicationItem>
              
              <PublicationItem>
                <strong>
                  <a href="https://doi.org/10.1007/978-3-031-61007-3_16">
                    Building BESSER: an open-source low-code platform
                  </a><br />
                  Iván Alfonso, Aaron Conrardy, Armen Sulejmani, Atefeh Nirumand, Fitash Ul Haq, Marcos Gomez-Vazquez, Jean-Sébastien Sottet, Jordi Cabot
                </strong>
                Exploring Modeling Methods for Systems Analysis and Development (EMMSAD 2024)
              </PublicationItem>
            </ol>
            
            <h5 style={{color: '#667eea', marginTop: '2rem', marginBottom: '1.5rem'}}>Workshop Papers</h5>
            <ol style={{paddingLeft: '1.5rem'}}>
              <PublicationItem>
                <strong>
                  <a href="https://dl.acm.org/doi/abs/10.1145/3652620.3688330">
                    Low-Code Flutter Application Development Solution
                  </a><br />
                  Atefeh Nirumand Jazi, Iván Alfonso, and Jordi Cabot
                </strong>
                5th International Workshop on Modeling in Low-Code Development Platforms (LowCode 2024).
              </PublicationItem>
              
              <PublicationItem>
                <strong>
                  <a href="https://doi.org/10.48550/arXiv.2404.11376">
                    From Image to UML: First Results of Image Based UML Diagram Generation Using LLMs
                  </a><br />
                  Aaron Conrardy and Jordi Cabot
                </strong>
                First Large Language Models for Model-Driven Engineering Workshop (LLM4MDE 2024)
              </PublicationItem>
              
              <PublicationItem>
                <strong>
                  <a href="https://ceur-ws.org/Vol-3744/paper1.pdf">
                    A Leaderboard to Benchmark Ethical Biases in LLMs
                  </a><br />
                  Marcos Gomez-Vazquez, Sergio Morales, German Castignani, Robert Clarisó, Aaron Conrardy, Louis Deladiennee, Samuel Renault and Jordi Cabot
                </strong>
                Proceedings of the 1st Workshop on AI bias: Measurements, Mitigation, Explanation Strategies (AIMMES 2024)
              </PublicationItem>
            </ol>
          </PublicationsCard>
        </Container>
      </Section>

      <Section className="contact">
        <Container>
          <SectionTitle>Contact Us</SectionTitle>
          <ContactCard>
            <h4 style={{color: '#333', marginBottom: '1.5rem'}}>Get in Touch</h4>
            <p style={{fontSize: '1.1rem', color: '#666', marginBottom: '1.5rem'}}>
              You can reach us at: <ContactLink href="mailto:info@besser-pearl.org">info@besser-pearl.org</ContactLink>
            </p>
            
            <Row className="mt-4">
              <Col md={4}>
                <h6 style={{color: '#667eea', marginBottom: '1rem'}}>Location</h6>
                <p style={{color: '#666', fontSize: '0.9rem'}}>
                  5 Av. des Hauts-Fourneaux<br />
                  4362 Esch-Belval Esch-sur-Alzette
                </p>
              </Col>
              <Col md={4}>
                <h6 style={{color: '#667eea', marginBottom: '1rem'}}>Follow Us</h6>
                <div style={{display: 'flex', gap: '1rem', justifyContent: 'center'}}>
                  <a href="https://twitter.com/JordiCabot" style={{color: '#667eea', fontSize: '1.5rem'}}>🐦</a>
                  <a href="https://www.linkedin.com/in/jcabot/" style={{color: '#667eea', fontSize: '1.5rem'}}>💼</a>
                  <a href="https://github.com/BESSER-PEARL/BESSER" style={{color: '#667eea', fontSize: '1.5rem'}}>🐙</a>
                  <a href="https://www.youtube.com/@BESSER-PEARL" style={{color: '#667eea', fontSize: '1.5rem'}}>📺</a>
                </div>
              </Col>
              <Col md={4}>
                <h6 style={{color: '#667eea', marginBottom: '1rem'}}>Credits</h6>
              </Col>
            </Row>
          </ContactCard>
        </Container>
      </Section>
    </PageContainer>
  );
};
