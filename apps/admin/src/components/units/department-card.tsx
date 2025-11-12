"use client";

import { useState } from 'react';
import { Department } from '@/lib/admin/departments';
import { Badge } from '@repo/ui/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@repo/ui/components/ui/dialog';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import Image from 'next/image';
import { Users, MapPin, Tag, Calendar, Edit } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Client-side only component for HTML content
function HTMLContent({ html, className }: { html: string, className?: string }) {
  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: html }} 
    />
  );
}

interface DepartmentCardProps {
  department: Department;
  onEdit?: (department: Department) => void;
}

export function DepartmentCard({ department, onEdit }: DepartmentCardProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const router = useRouter();
  const placeholderLogo = "https://via.placeholder.com/80?text=" + 
    encodeURIComponent(department.name.substring(0, 2));
  
  const logoUrl = department.logo || placeholderLogo;
  
  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg border-transparent hover:border-primary/10 group">
      <CardHeader className="p-0 overflow-hidden h-36 relative">
        <div 
          className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent z-10 
                    transition-opacity duration-300 opacity-70 group-hover:opacity-90" 
        />
        
        <div className="absolute top-3 right-3 z-20">
          {!department.active && (
            <Badge variant="destructive" className="ml-2">Inactive</Badge>
          )}
          {department.type && (
            <Badge variant="outline" className="ml-2 bg-black/40 backdrop-blur-sm border-white/10 text-white">
              {department.type}
            </Badge>
          )}
        </div>
        
        <div className="h-full w-full relative">
          {/* Background pattern */}
          <div className="absolute inset-0 bg-gradient-radial from-primary/20 to-background/5 opacity-70"></div>
          
          {/* Department logo as an overlay */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3">
            <div className="h-12 w-12 rounded-full overflow-hidden bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
              {department.logo ? (
                <Image 
                  src={logoUrl}
                  alt={department.name}
                  width={48}
                  height={48}
                  className="object-cover h-full w-full"
                />
              ) : (
                <span className="text-xl font-bold text-white">
                  {department.name.substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <h3 className="font-bold text-white text-xl drop-shadow-md line-clamp-2">
              {department.name}
            </h3>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin size={16} />
            <span>{department.campusName || 'No campus assigned'}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users size={16} />
            <span>{department.userCount || 0} members</span>
          </div>
          
          {department.description && (
            <HTMLContent 
              html={department.description}
              className="mt-2 text-sm line-clamp-2 text-muted-foreground"
            />
          )}
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0 flex justify-between">
            <Button onClick={() => router.push(`/admin/units/${department.$id}`)} variant="outline" size="sm">View Details</Button>
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={() => onEdit(department)}>
            <Edit size={16} className="mr-2" />
            Edit
          </Button>
        )}
      </CardFooter>
    </Card>
  );
} 