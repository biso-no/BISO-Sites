"use client"
import React, { useState } from 'react';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { Button } from '@repo/ui/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@repo/ui/components/ui/dialog';
import Image from 'next/image';

// Mock data for templates
const mockTemplates = [
  { id: 1, name: 'Blog Post', thumbnail: '/images/placeholder.jpg' },
  { id: 2, name: 'Landing Page', thumbnail: '/images/placeholder.jpg' },
  { id: 3, name: 'Product Page', thumbnail: '/images/placeholder.jpg' },
];

const TemplateCard = ({ template, onEdit, onDelete }: { template: any, onEdit: (template: any) => void, onDelete: (template: any) => void }) => (
  <Card className="w-64">
    <CardHeader>
      <CardTitle>{template.name}</CardTitle>
    </CardHeader>
    <CardContent>
      <Image src={template.thumbnail} alt={template.name} className="w-full h-40 object-cover" width={200} height={300} />
    </CardContent>
    <CardFooter className="flex justify-between">
      <Button variant="outline" size="sm" onClick={() => onEdit(template)}>
        <Edit className="mr-2 h-4 w-4" /> Edit
      </Button>
      <Button variant="destructive" size="sm" onClick={() => onDelete(template)}>
        <Trash2 className="mr-2 h-4 w-4" /> Delete
      </Button>
    </CardFooter>
  </Card>
);

const TemplateDialog = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create/Edit Template</DialogTitle>
      </DialogHeader>
      {/* Here you would integrate PuckEditor */}
      <div className="h-96 bg-gray-100 flex items-center justify-center">
        PuckEditor would be integrated here
      </div>
    </DialogContent>
  </Dialog>
);

const TemplateManagement = () => {
  const [templates, setTemplates] = useState(mockTemplates);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setIsDialogOpen(true);
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    setIsDialogOpen(true);
  };

  const handleDeleteTemplate = (template: any) => {
    setTemplates(templates.filter(t => t.id !== template.id));
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Page Templates</h2>
        <Button onClick={handleCreateTemplate}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Template
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            onEdit={handleEditTemplate}
            onDelete={handleDeleteTemplate}
          />
        ))}
      </div>
      <TemplateDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  );
};

export default TemplateManagement;