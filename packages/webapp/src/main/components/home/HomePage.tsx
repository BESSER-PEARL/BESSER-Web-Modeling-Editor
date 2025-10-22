// import React, { useState, useEffect } from 'react';
// import { Button, Card, Container, Row, Col, Badge, Modal } from 'react-bootstrap';
// import { useAppDispatch } from '../store/hooks';
// import { showModal } from '../../services/modal/modalSlice';
// import { ModalContentType } from '../modals/application-modal-types';
// import { 
//   PlusCircle, 
//   Upload, 
//   FileEarmark, 
//   BoxArrowInUp, 
//   Diagram3,
//   Diagram2,
//   Robot,
//   ArrowRepeat,
//   Clock,
//   Folder,
//   Star,
//   GraphUp,
//   People,
//   ShieldCheck,
//   Lightning,
//   Download,
//   Trash,
//   ChevronDown,
//   ChevronUp
// } from 'react-bootstrap-icons';
// import styled from 'styled-components';
// import { 
//   getLastProjectFromLocalStorage, 
//   getAllProjectsFromLocalStorage, 
//   BesserProject, 
//   removeProjectFromLocalStorage 
// } from '../../utils/localStorage';
// import { useNavigate } from 'react-router-dom';
// import { exportProjectById } from '../../services/export/useExportProjectJSON';
// import { handleImportProject as importProjectService } from '../../services/import/useImportProjectJSON';
// import { toast } from 'react-toastify';

// const PageContainer = styled.div`
//   min-height: 100vh;
//   background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
//   position: relative;
//   overflow-x: hidden;
//   /* Account for the fixed navbar */
//   padding-top: 60px;
// `;

// const HeroSection = styled.div`
//   padding: 4rem 2rem;
//   text-align: center;
//   color: white;
// `;

// const HeroTitle = styled.h1`
//   font-size: 3.5rem;
//   font-weight: 800;
//   margin-bottom: 1rem;
//   background: linear-gradient(45deg, #fff, #e3f2fd);
//   -webkit-background-clip: text;
//   -webkit-text-fill-color: transparent;
//   background-clip: text;
// `;

// const HeroSubtitle = styled.p`
//   font-size: 1.3rem;
//   margin-bottom: 3rem;
//   opacity: 0.9;
//   max-width: 600px;
//   margin-left: auto;
//   margin-right: auto;
//   line-height: 1.6;
// `;

// const ActionSection = styled(Container)`
//   max-width: 1200px;
//   margin-bottom: 4rem;
// `;

// const ActionCard = styled(Card)`
//   background: rgba(255, 255, 255, 0.95);
//   backdrop-filter: blur(20px);
//   border: 1px solid rgba(255, 255, 255, 0.2);
//   border-radius: 20px;
//   padding: 2rem;
//   height: 100%;
//   transition: all 0.3s ease;
//   cursor: pointer;
  
//   &:hover {
//     transform: translateY(-8px);
//     box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
//     background: rgba(255, 255, 255, 1);
//   }
// `;

// const ActionIcon = styled.div`
//   width: 80px;
//   height: 80px;
//   border-radius: 20px;
//   display: flex;
//   align-items: center;
//   justify-content: center;
//   margin: 0 auto 1.5rem;
//   font-size: 2rem;
//   color: white;
// `;

// const ActionTitle = styled.h3`
//   font-size: 1.4rem;
//   font-weight: 700;
//   margin-bottom: 1rem;
//   color: #333;
// `;

// const ActionDescription = styled.p`
//   color: #666;
//   margin-bottom: 1.5rem;
//   line-height: 1.5;
// `;

// const QuickStartButton = styled(Button)`
//   width: 100%;
//   padding: 12px;
//   font-weight: 600;
//   border-radius: 12px;
//   border: none;
//   transition: all 0.3s ease;
  
//   &:hover {
//     transform: translateY(-2px);
//     box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
//   }
// `;

// const RecentProjectsSection = styled.div`
//   background: rgba(255, 255, 255, 0.1);
//   backdrop-filter: blur(20px);
//   padding: 3rem 2rem;
//   margin-top: 4rem;
// `;

// const RecentProjectCard = styled(Card)`
//   background: rgba(255, 255, 255, 0.95);
//   border: none;
//   border-radius: 16px;
//   padding: 1.5rem;
//   margin-bottom: 1rem;
//   transition: all 0.3s ease;
//   cursor: pointer;
  
//   &:hover {
//     transform: translateY(-4px);
//     box-shadow: 0 12px 30px rgba(0, 0, 0, 0.1);
//   }
// `;

// const ProjectInfo = styled.div`
//   display: flex;
//   align-items: center;
//   justify-content: space-between;
// `;

// const ProjectDetails = styled.div`
//   flex: 1;
// `;

// const ProjectName = styled.h5`
//   font-weight: 700;
//   color: #333;
//   margin-bottom: 0.5rem;
// `;

// const ProjectMeta = styled.div`
//   color: #666;
//   font-size: 0.9rem;
//   display: flex;
//   align-items: center;
//   gap: 1rem;
// `;

// const FeatureSection = styled.div`
//   padding: 4rem 2rem;
//   background: rgba(255, 255, 255, 0.05);
// `;

// const FeatureGrid = styled.div`
//   display: grid;
//   grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
//   gap: 2rem;
//   max-width: 1200px;
//   margin: 0 auto;
// `;

// const FeatureCard = styled.div`
//   background: rgba(255, 255, 255, 0.1);
//   backdrop-filter: blur(20px);
//   border: 1px solid rgba(255, 255, 255, 0.1);
//   border-radius: 16px;
//   padding: 2rem;
//   text-align: center;
//   color: white;
// `;

// const FeatureIcon = styled.div`
//   font-size: 3rem;
//   margin-bottom: 1.5rem;
//   opacity: 0.9;
// `;

// const FeatureTitle = styled.h4`
//   font-weight: 700;
//   margin-bottom: 1rem;
// `;

// const FeatureDescription = styled.p`
//   opacity: 0.8;
//   line-height: 1.5;
// `;

// const AllProjectsToggle = styled.div`
//   text-align: center;
//   margin-top: 2rem;
// `;

// const ToggleButton = styled(Button)`
//   background: rgba(255, 255, 255, 0.1);
//   border: 1px solid rgba(255, 255, 255, 0.3);
//   color: white;
//   border-radius: 20px;
//   padding: 10px 20px;
//   font-weight: 600;
//   transition: all 0.3s ease;
  
//   &:hover {
//     background: rgba(255, 255, 255, 0.2);
//     border-color: rgba(255, 255, 255, 0.5);
//     transform: translateY(-2px);
//   }
// `;

// const AllProjectsList = styled.div`
//   margin-top: 2rem;
//   max-height: 400px;
//   overflow-y: auto;
// `;

// export const HomePage: React.FC = () => {
//   const dispatch = useAppDispatch();
//   const navigate = useNavigate();
//   const [recentProject, setRecentProject] = useState<BesserProject | null>(null);
//   const [allProjects, setAllProjects] = useState<BesserProject[]>([]);
//   const [showAllProjects, setShowAllProjects] = useState(false);

//   useEffect(() => {
//     const project = getLastProjectFromLocalStorage();
//     const projects = getAllProjectsFromLocalStorage();
//     setRecentProject(project);
//     setAllProjects(projects);
//   }, []);

//   const handleCreateProject = () => {
//     dispatch(showModal({ type: ModalContentType.CreateProjectModal }));
//   };

//   const handleImportProject = () => {
//     dispatch(showModal({ type: ModalContentType.ImportProjectModal }));
//   };

//   const handleCreateDiagram = () => {
//     dispatch(showModal({ type: ModalContentType.CreateDiagramModal }));
//   };

//   const handleOpenProject = () => {
//     navigate('/editor');
//   };

//   const handleOpenSpecificProject = (project: BesserProject) => {
//     // Save as latest project and navigate
//     localStorage.setItem('besser_latest_project', project.id);
//     navigate('/editor');
//   };

//   const handleProjectSettings = () => {
//     navigate('/project-settings');
//   };

//   const handleExportProject = async () => {
//     if (!recentProject) return;
    
//     try {
//       await exportProjectById(recentProject);
//       toast.success('Project exported successfully!');
//     } catch (error) {
//       console.error('Error exporting project:', error);
//       toast.error('Failed to export project');
//     }
//   };

//   const handleDeleteProject = async () => {
//     if (!recentProject) return;
    
//     const confirmDelete = window.confirm(
//       `Are you sure you want to delete the project "${recentProject.name}"? This action cannot be undone.`
//     );
    
//     if (confirmDelete) {
//       try {
//         // Remove project and its diagrams from localStorage
//         if (recentProject.models) {
//           recentProject.models.forEach(diagramId => {
//             localStorage.removeItem(`besser_diagram_${diagramId}`);
//           });
//         }
        
//         removeProjectFromLocalStorage(recentProject.id);
//         setRecentProject(null);
//         // Refresh the projects list
//         const updatedProjects = getAllProjectsFromLocalStorage();
//         setAllProjects(updatedProjects);
//         toast.success('Project deleted successfully!');
//       } catch (error) {
//         console.error('Error deleting project:', error);
//         toast.error('Failed to delete project');
//       }
//     }
//   };

//   const handleDeleteSpecificProject = async (project: BesserProject, e: React.MouseEvent) => {
//     e.stopPropagation();
    
//     const confirmDelete = window.confirm(
//       `Are you sure you want to delete the project "${project.name}"? This action cannot be undone.`
//     );
    
//     if (confirmDelete) {
//       try {
//         // Remove project and its diagrams from localStorage
//         if (project.models) {
//           project.models.forEach(diagramId => {
//             localStorage.removeItem(`besser_diagram_${diagramId}`);
//           });
//         }
        
//         removeProjectFromLocalStorage(project.id);
        
//         // Update the projects list
//         const updatedProjects = getAllProjectsFromLocalStorage();
//         setAllProjects(updatedProjects);
        
//         // If this was the recent project, clear it
//         if (recentProject?.id === project.id) {
//           setRecentProject(updatedProjects.length > 0 ? updatedProjects[0] : null);
//         }
        
//         toast.success('Project deleted successfully!');
//       } catch (error) {
//         console.error('Error deleting project:', error);
//         toast.error('Failed to delete project');
//       }
//     }
//   };
//   return (
//     <PageContainer>
//       <HeroSection>
//         <HeroTitle>Welcome to BESSER</HeroTitle>
//         <HeroSubtitle>
//           Transform your ideas into reality with our comprehensive low-code platform for UML modeling, 
//           code generation, and collaborative software development.
//         </HeroSubtitle>

//         <ActionSection>
//           <Row>
//             <Col md={4} className="mb-4">
//               <ActionCard onClick={handleCreateProject}>
//                 <ActionIcon style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
//                   <PlusCircle />
//                 </ActionIcon>
//                 <ActionTitle>Create New Project</ActionTitle>
//                 <ActionDescription>
//                   Start a new project with multiple UML diagrams and collaborative features
//                 </ActionDescription>
//                 <QuickStartButton variant="primary">
//                   Get Started
//                 </QuickStartButton>
//               </ActionCard>
//             </Col>

//             <Col md={4} className="mb-4">
//               <ActionCard onClick={handleImportProject}>
//                 <ActionIcon style={{ background: 'linear-gradient(135deg, #28a745, #20c997)' }}>
//                   <Upload />
//                 </ActionIcon>
//                 <ActionTitle>Import Project</ActionTitle>
//                 <ActionDescription>
//                   Import existing projects or diagrams to continue your work
//                 </ActionDescription>
//                 <QuickStartButton variant="success">
//                   Import Now
//                 </QuickStartButton>
//               </ActionCard>
//             </Col>

//             <Col md={4} className="mb-4">
//               <ActionCard onClick={handleCreateDiagram}>
//                 <ActionIcon style={{ background: 'linear-gradient(135deg, #fd7e14, #e83e8c)' }}>
//                   <Diagram3 />
//                 </ActionIcon>
//                 <ActionTitle>Quick Diagram</ActionTitle>
//                 <ActionDescription>
//                   Create a single diagram without a project structure
//                 </ActionDescription>
//                 <QuickStartButton variant="warning">
//                   Start Modeling
//                 </QuickStartButton>
//               </ActionCard>
//             </Col>
//           </Row>
//         </ActionSection>
//       </HeroSection>

//       {recentProject && (
//         <RecentProjectsSection>
//           <Container style={{ maxWidth: '1200px' }}>
//             <h3 style={{ color: 'white', marginBottom: '2rem', textAlign: 'center' }}>
//               Continue Your Work
//             </h3>
//             <RecentProjectCard onClick={handleOpenProject}>
//               <ProjectInfo>
//                 <ProjectDetails>
//                   <ProjectName>{recentProject.name}</ProjectName>
//                   <ProjectMeta>
//                     <span>
//                       <Clock size={14} style={{ marginRight: '0.5rem' }} />
//                       Last modified: {new Date(recentProject.createdAt).toLocaleDateString()}
//                     </span>
//                     <span>
//                       <Folder size={14} style={{ marginRight: '0.5rem' }} />
//                       {recentProject.models?.length || 0} diagrams
//                     </span>
//                   </ProjectMeta>
//                 </ProjectDetails>                <div>
//                   <Button variant="outline-primary" size="sm" onClick={handleOpenProject}>
//                     Open Project
//                   </Button>
//                   <Button 
//                     variant="outline-success" 
//                     size="sm" 
//                     className="ms-2"
//                     onClick={(e) => {
//                       e.stopPropagation();
//                       handleExportProject();
//                     }}
//                     title="Export project as file"
//                   >
//                     <BoxArrowInUp size={14} /> Export
//                   </Button>
//                   <Button 
//                     variant="outline-secondary" 
//                     size="sm" 
//                     className="ms-2"
//                     onClick={(e) => {
//                       e.stopPropagation();
//                       handleProjectSettings();
//                     }}
//                   >
//                     Settings
//                   </Button>
//                   <Button 
//                     variant="outline-danger" 
//                     size="sm" 
//                     className="ms-2"
//                     onClick={(e) => {
//                       e.stopPropagation();
//                       handleDeleteProject();
//                     }}
//                     title="Delete project"
//                   >
//                     <Trash size={14} />
//                   </Button>
//                 </div>
//               </ProjectInfo>
//             </RecentProjectCard>
            
//             {/* Toggle for all projects */}
//             <AllProjectsToggle>
//               <ToggleButton 
//                 variant="outline-light" 
//                 onClick={() => setShowAllProjects(!showAllProjects)}
//                 className="d-flex align-items-center justify-content-center"
//               >
//                 {showAllProjects ? (
//                   <>
//                     <ChevronUp className="me-2" />
//                     Hide Other Projects
//                   </>
//                 ) : (
//                   <>
//                     <ChevronDown className="me-2" />
//                     Show All Projects ({allProjects.filter(p => p.id !== recentProject?.id).length})
//                   </>
//                 )}
//               </ToggleButton>
//             </AllProjectsToggle>

//             {/* All projects list */}
//             {showAllProjects && (
//               <AllProjectsList>
//                 {allProjects
//                   .filter(project => project.id !== recentProject?.id)
//                   .map(project => (
//                     <RecentProjectCard 
//                       key={project.id} 
//                       onClick={() => handleOpenSpecificProject(project)}
//                       style={{ marginBottom: '1rem' }}
//                     >
//                       <ProjectInfo>
//                         <ProjectDetails>
//                           <ProjectName>{project.name}</ProjectName>
//                           <ProjectMeta>
//                             <span>
//                               <Clock size={14} style={{ marginRight: '0.5rem' }} />
//                               Created: {new Date(project.createdAt).toLocaleDateString()}
//                             </span>
//                             <span>
//                               <Folder size={14} style={{ marginRight: '0.5rem' }} />
//                               {project.models?.length || 0} diagrams
//                             </span>
//                           </ProjectMeta>
//                         </ProjectDetails>
//                         <div>
//                           <Button 
//                             variant="outline-primary" 
//                             size="sm" 
//                             onClick={(e) => {
//                               e.stopPropagation();
//                               handleOpenSpecificProject(project);
//                             }}
//                           >
//                             Open
//                           </Button>
//                           <Button 
//                             variant="outline-success" 
//                             size="sm" 
//                             className="ms-2"
//                             onClick={async (e) => {
//                               e.stopPropagation();
//                               try {
//                                 await exportProjectById(project);
//                                 toast.success('Project exported successfully!');
//                               } catch (error) {
//                                 console.error('Error exporting project:', error);
//                                 toast.error('Failed to export project');
//                               }
//                             }}
//                             title="Export project as file"
//                           >
//                             <BoxArrowInUp size={14} />
//                           </Button>
//                           <Button 
//                             variant="outline-danger" 
//                             size="sm" 
//                             className="ms-2"
//                             onClick={(e) => handleDeleteSpecificProject(project, e)}
//                             title="Delete project"
//                           >
//                             <Trash size={14} />
//                           </Button>
//                         </div>
//                       </ProjectInfo>
//                     </RecentProjectCard>
//                   ))
//                 }
//                 {allProjects.filter(p => p.id !== recentProject?.id).length === 0 && (
//                   <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)', padding: '2rem' }}>
//                     No other projects found.
//                   </div>
//                 )}
//               </AllProjectsList>
//             )}
//           </Container>
//         </RecentProjectsSection>
//       )}

//       {/* Show all projects section if no recent project */}
//       {!recentProject && allProjects.length > 0 && (
//         <RecentProjectsSection>
//           <Container style={{ maxWidth: '1200px' }}>
//             <h3 style={{ color: 'white', marginBottom: '2rem', textAlign: 'center' }}>
//               Your Projects
//             </h3>
//             <AllProjectsList>
//               {allProjects.map(project => (
//                 <RecentProjectCard 
//                   key={project.id} 
//                   onClick={() => handleOpenSpecificProject(project)}
//                   style={{ marginBottom: '1rem' }}
//                 >
//                   <ProjectInfo>
//                     <ProjectDetails>
//                       <ProjectName>{project.name}</ProjectName>
//                       <ProjectMeta>
//                         <span>
//                           <Clock size={14} style={{ marginRight: '0.5rem' }} />
//                           Created: {new Date(project.createdAt).toLocaleDateString()}
//                         </span>
//                         <span>
//                           <Folder size={14} style={{ marginRight: '0.5rem' }} />
//                           {project.models?.length || 0} diagrams
//                         </span>
//                       </ProjectMeta>
//                     </ProjectDetails>
//                     <div>
//                       <Button 
//                         variant="outline-primary" 
//                         size="sm" 
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           handleOpenSpecificProject(project);
//                         }}
//                       >
//                         Open
//                       </Button>
//                       <Button 
//                         variant="outline-success" 
//                         size="sm" 
//                         className="ms-2"
//                         onClick={async (e) => {
//                           e.stopPropagation();
//                           try {
//                             await exportProjectById(project);
//                             toast.success('Project exported successfully!');
//                           } catch (error) {
//                             console.error('Error exporting project:', error);
//                             toast.error('Failed to export project');
//                           }
//                         }}
//                         title="Export project as file"
//                       >
//                         <BoxArrowInUp size={14} />
//                       </Button>
//                       <Button 
//                         variant="outline-danger" 
//                         size="sm" 
//                         className="ms-2"
//                         onClick={(e) => handleDeleteSpecificProject(project, e)}
//                         title="Delete project"
//                       >
//                         <Trash size={14} />
//                       </Button>
//                     </div>
//                   </ProjectInfo>
//                 </RecentProjectCard>
//               ))}
//             </AllProjectsList>
//           </Container>
//         </RecentProjectsSection>
//       )}

//       <FeatureSection>
//         <Container style={{ maxWidth: '1200px' }}>
//           <h3 style={{ color: 'white', textAlign: 'center', marginBottom: '3rem' }}>
//             Why Choose BESSER?
//           </h3>
//           <FeatureGrid>
//             <FeatureCard>
//               <FeatureIcon><Diagram3 /></FeatureIcon>
//               <FeatureTitle>UML Modeling</FeatureTitle>
//               <FeatureDescription>
//                 Create comprehensive UML diagrams including Class, Object, State Machine, and Agent diagrams
//               </FeatureDescription>
//             </FeatureCard>            <FeatureCard>
//               <FeatureIcon><Lightning /></FeatureIcon>
//               <FeatureTitle>Code Generation</FeatureTitle>
//               <FeatureDescription>
//                 Generate production-ready code from your models in multiple programming languages
//               </FeatureDescription>
//             </FeatureCard>

//             <FeatureCard>
//               <FeatureIcon><People /></FeatureIcon>
//               <FeatureTitle>Collaboration</FeatureTitle>
//               <FeatureDescription>
//                 Work together in real-time with your team members on the same project
//               </FeatureDescription>
//             </FeatureCard>

//             <FeatureCard>
//               <FeatureIcon><ShieldCheck /></FeatureIcon>
//               <FeatureTitle>Quality Assurance</FeatureTitle>
//               <FeatureDescription>
//                 Built-in validation and quality checks to ensure your models are consistent and error-free
//               </FeatureDescription>
//             </FeatureCard>

//             <FeatureCard>
//               <FeatureIcon><GraphUp /></FeatureIcon>
//               <FeatureTitle>Version Control</FeatureTitle>
//               <FeatureDescription>
//                 Track changes and manage different versions of your diagrams and projects
//               </FeatureDescription>
//             </FeatureCard>

//             <FeatureCard>
//               <FeatureIcon><Star /></FeatureIcon>
//               <FeatureTitle>Export Options</FeatureTitle>
//               <FeatureDescription>
//                 Export your work in multiple formats including SVG, PNG, JSON, and B-UML
//               </FeatureDescription>
//             </FeatureCard>
//           </FeatureGrid>
//         </Container>
//       </FeatureSection>
//     </PageContainer>
//   );
// };
